/**
 * Actor-aware and abortable database transactions.
 *
 * Provides two transaction primitives:
 *
 * - **{@link withActor}** — wraps database writes in an interactive
 *   transaction that sets a PostgreSQL session variable
 *   (`app.current_user_id`) identifying the user who initiated the
 *   change. The audit triggers in `scripts/triggers.sql` read this
 *   variable via `resolve_actor()` to populate the `changed_by` /
 *   `deleted_by` columns in `audit.change_log` and
 *   `audit.deleted_records`.
 *
 * - **{@link abortable}** — wraps a transaction so it can be
 *   cancelled via an `AbortSignal`. When the signal fires the
 *   in-flight promise is rejected with a
 *   {@link TransactionAbortedError}, which propagates into the
 *   Prisma `$transaction` callback and triggers a ROLLBACK.
 *
 * Both functions accept an optional `AbortSignal`. When `withActor`
 * receives a signal the transaction is both actor-tracked **and**
 * abortable.
 *
 * ## How actor resolution works
 *
 * | Scenario                        | `changed_by` / `deleted_by` value |
 * |---------------------------------|-----------------------------------|
 * | API request (authenticated)     | User CUID (e.g. `cm3abc123...`)   |
 * | Migration / Prisma CLI          | PostgreSQL role (e.g. `postgres`) |
 * | Manual `psql` session           | PostgreSQL role (e.g. `admin`)    |
 * | Cron job / background task      | PostgreSQL role (fallback)        |
 *
 * `SET LOCAL` scopes the variable to the current transaction —
 * it resets automatically on commit or rollback, so pooled
 * connections are never contaminated.
 *
 * ## How abort works
 *
 * The transaction action is raced against a promise that rejects
 * when the supplied `AbortSignal` fires. Because the rejection
 * occurs inside the Prisma `$transaction` callback, Prisma
 * automatically issues a ROLLBACK — no partial writes are
 * committed. The caller receives a {@link TransactionAbortedError}
 * that it can match on by `name` or `instanceof`.
 *
 * @module actor
 */

import type { PrismaClient } from '@database/generated/prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Transaction client type accepted by data-layer functions.
 *
 * This is intentionally typed as `PrismaClient` to match the `Db`
 * alias used throughout the server's data layer. Prisma's interactive
 * transaction client is structurally compatible for all model
 * operations — the cast inside {@link withActor} is safe.
 */
type TransactionClient = PrismaClient;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * Thrown when a transaction is rolled back because its `AbortSignal`
 * fired before the action completed.
 *
 * Callers can identify this error by class (`instanceof`) or by the
 * stable `name` property (`'TransactionAbortedError'`).
 *
 * @example
 * ```ts
 * const { data, error } = await tryCatch(
 *   context.withActor(async (tx) => { ... }, controller.signal)
 * );
 * if (error instanceof TransactionAbortedError) {
 *   // The client cancelled the request — nothing was committed.
 * }
 * ```
 */
export class TransactionAbortedError extends Error {
	override readonly name = 'TransactionAbortedError' as const;

	constructor(reason?: string) {
		super(reason ?? 'Transaction aborted');
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the human-readable abort reason from a signal.
 *
 * `AbortSignal.reason` can be any value — we normalise it to a
 * string (or `undefined`) for the error message.
 */
function abortReason(signal: AbortSignal): string | undefined {
	if (signal.reason === undefined) return undefined;
	if (typeof signal.reason === 'string') return signal.reason;
	if (signal.reason instanceof Error) return signal.reason.message;
	return String(signal.reason);
}

/**
 * Races a promise against an `AbortSignal`.
 *
 * If the signal fires before `promise` settles, the returned promise
 * rejects with a {@link TransactionAbortedError}. The abort listener
 * is cleaned up in all code paths (resolve, reject, abort) to
 * prevent memory leaks.
 */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	// Fast path — already aborted before we even start racing.
	if (signal.aborted) {
		return Promise.reject(new TransactionAbortedError(abortReason(signal)));
	}

	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			reject(new TransactionAbortedError(abortReason(signal)));
		};

		// `{ once: true }` ensures the listener auto-removes on fire,
		// but we still need the manual cleanup for the non-abort paths.
		signal.addEventListener('abort', onAbort, { once: true });

		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', onAbort);
				reject(error);
			}
		);
	});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wraps a callback in an interactive transaction with actor context
 * and optional abort support.
 *
 * ### Actor tracking
 *
 * Sets `app.current_user_id` via `SET LOCAL` so that PostgreSQL
 * audit triggers can attribute the change to the authenticated API
 * user. The variable is scoped to the transaction and automatically
 * resets when the transaction commits or rolls back — no cleanup is
 * needed and pooled connections are never contaminated.
 *
 * When `actorId` is `null` (unauthenticated or system operation),
 * no session variable is set and the triggers fall back to
 * `session_user` (the PostgreSQL role name).
 *
 * ### Abort support
 *
 * When an `AbortSignal` is provided, the action is raced against
 * the signal. If the signal fires before the action resolves, the
 * transaction is rolled back and a {@link TransactionAbortedError}
 * is thrown to the caller.
 *
 * ### Nestable
 *
 * If `db` is already an interactive-transaction client (i.e. it
 * was produced by an outer `withActor` call), no new transaction is
 * created — `fn` is invoked directly with the existing client.
 * The actor context set by the outer call remains in effect, so
 * data-layer functions can unconditionally call `withActor` without
 * worrying about whether they are composed inside a larger
 * transaction.
 *
 * @param db       The Prisma client instance (singleton or extended).
 *                 May also be an interactive-transaction client from
 *                 an outer `withActor` — see *Nestable* above.
 * @param actorId  The authenticated user's CUID, or `null`.
 * @param fn       Callback receiving the transaction client. Use it
 *                 exactly as you would the regular `db` — all data
 *                 layer functions accept it via the `Db` type alias.
 * @param signal   Optional `AbortSignal` — when aborted the
 *                 transaction is rolled back and a
 *                 {@link TransactionAbortedError} is thrown.
 * @returns        The value returned by `fn`.
 *
 * @example
 * ```ts
 * import { withActor } from '@rainestack/database/actor';
 *
 * // Actor-tracked transaction:
 * const updated = await withActor(db, context.user.id, async (tx) => {
 *   return users.updateProfile(tx, userId, { name: 'New Name' });
 * });
 * ```
 *
 * @example
 * ```ts
 * // Actor-tracked + abortable:
 * const controller = new AbortController();
 * setTimeout(() => controller.abort('timeout'), 5_000);
 *
 * const result = await withActor(db, context.user.id, async (tx) => {
 *   return posts.create(tx, data);
 * }, controller.signal);
 * ```
 */
export async function withActor<T>(
	db: PrismaClient,
	actorId: string | null,
	fn: (tx: TransactionClient) => Promise<T>,
	signal?: AbortSignal
): Promise<T> {
	// ------------------------------------------------------------------
	// Nestable: if `db` is already an interactive-transaction client
	// (produced by an outer withActor / $transaction call) it will not
	// expose `$transaction`.  In that case we skip wrapping — the
	// actor context was already set by the outer call.
	// ------------------------------------------------------------------
	if (typeof (db as unknown as Record<string, unknown>).$transaction !== 'function') {
		if (signal?.aborted) {
			throw new TransactionAbortedError(abortReason(signal));
		}
		const result = fn(db as unknown as TransactionClient);
		return signal ? raceAbort(result, signal) : result;
	}

	return db.$transaction(async (tx) => {
		// Bail out immediately if already aborted.
		if (signal?.aborted) {
			throw new TransactionAbortedError(abortReason(signal));
		}

		if (actorId) {
			// SET LOCAL scopes the variable to this transaction only.
			// The parameterised form prevents SQL injection.
			await tx.$queryRawUnsafe(`SELECT set_config('app.current_user_id', $1, true)`, actorId);
		}

		// Check again after the SET LOCAL round-trip — the signal may
		// have fired while we were waiting on PostgreSQL.
		if (signal?.aborted) {
			throw new TransactionAbortedError(abortReason(signal));
		}

		// The transaction client is structurally compatible with
		// PrismaClient for all model operations. The cast allows
		// data-layer functions typed as `(db: Db, ...) => ...` to
		// accept it without friction.
		const result = fn(tx as unknown as TransactionClient);

		return signal ? raceAbort(result, signal) : result;
	});
}

/**
 * Wraps a callback in an abortable interactive transaction.
 *
 * This is a convenience wrapper for transactions that need abort
 * support but **not** actor tracking. Functionally equivalent to
 * `withActor(db, null, fn, signal)`.
 *
 * When the `AbortSignal` fires before the action resolves, Prisma
 * issues a ROLLBACK and the caller receives a
 * {@link TransactionAbortedError}.
 *
 * @param db       The Prisma client instance.
 * @param signal   The `AbortSignal` controlling the transaction's
 *                 lifetime.
 * @param fn       Callback receiving the transaction client.
 * @returns        The value returned by `fn`.
 *
 * @example
 * ```ts
 * import { abortable, TransactionAbortedError } from '@rainestack/database/actor';
 * import { tryCatch } from '@rainestack/tools/try-catch';
 *
 * const controller = new AbortController();
 *
 * const { data, error } = await tryCatch(
 *   abortable(db, controller.signal, async (tx) => {
 *     const count = await tx.user.count();
 *     const records = await tx.user.findMany({ take: 50 });
 *     return { count, records };
 *   })
 * );
 *
 * if (error instanceof TransactionAbortedError) {
 *   console.log('Query was cancelled before it finished.');
 * }
 * ```
 */
export async function abortable<T>(
	db: PrismaClient,
	signal: AbortSignal,
	fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
	return db.$transaction(async (tx) => {
		if (signal.aborted) {
			throw new TransactionAbortedError(abortReason(signal));
		}

		const result = fn(tx as unknown as TransactionClient);

		return raceAbort(result, signal);
	});
}
