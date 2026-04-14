/**
 * Database context and lifecycle.
 *
 * Owns the singleton {@link DatabaseListener} and exposes:
 *
 * - **`connectListener()`** — one-shot initialiser called from the
 *   application entry point (`index.ts`) at startup. Connects the
 *   listener, registers default logging handlers, and resolves once
 *   the LISTEN subscription is active.
 *
 * - **`databaseMiddleware`** — zero-cost oRPC middleware that
 *   forwards the `db` and `listener` references into the handler
 *   context on every request. No I/O is performed here.
 *
 * - **`actorMiddleware`** — injects `actorId`, a pre-bound
 *   `withActor` helper, and a pre-bound `abortable` helper into the
 *   context after authentication has resolved the user. Route
 *   handlers use `context.withActor(fn)` to wrap writes in
 *   actor-tracked transactions and `context.abortable(signal, fn)`
 *   to wrap reads or writes in cancellable transactions.
 *
 * ## Connection architecture
 *
 * Both the Prisma client and the DatabaseListener connect directly
 * to PostgreSQL using the same `DATABASE_URL`. There is no external
 * connection pooler in the path, so all session-scoped PostgreSQL
 * features (LISTEN/NOTIFY, prepared statements, advisory locks) work
 * out of the box.
 *
 * | Consumer           | Connection type                     |
 * |--------------------|-------------------------------------|
 * | Prisma Client      | `pg.Pool` (pooled, via `PrismaPg`)  |
 * | DatabaseListener   | `pg.Client` (dedicated, long-lived) |
 *
 * @module database
 */

import { os } from '@orpc/server';
import { DatabaseListener, db, type PrismaClient } from '@rainestack/database';
import { abortable as abortableFn, withActor as withActorFn } from '@rainestack/database/actor';
import { env } from '@server/lib/env';
import { log } from '@server/lib/logger';

const dbLog = log.child({ module: 'database' });

// ---------------------------------------------------------------------------
// Singleton listener
// ---------------------------------------------------------------------------
// The listener requires a dedicated long-lived `pg.Client` connection
// (not a pool), so we create it once and reuse it for the lifetime of
// the process — mirroring how the `db` singleton works in
// @rainestack/database.
//
// Construction is cheap (no I/O). The actual TCP connection is
// established later when `connectListener()` is called at startup.
// ---------------------------------------------------------------------------

export { db };
export const listener = new DatabaseListener(env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Connects the database listener and registers default handlers.
 *
 * Must be called **once** from the application entry point before
 * the HTTP server starts accepting requests. Resolves when the
 * LISTEN subscription is active, or logs an error and continues
 * if the connection fails (the listener will retry automatically
 * via its built-in reconnection logic).
 */
export async function connectListener(): Promise<void> {
	listener.onChange((event) => {
		dbLog.debug({ operation: event.operation, schema: event.schema, table: event.table, id: event.id }, 'table change');
	});

	listener.onError((err) => {
		dbLog.error({ err }, 'listener error');
	});

	try {
		await listener.connect();
		dbLog.info('listener connected — watching for table changes');
	} catch (err) {
		// Log but don't throw — the listener's built-in reconnection
		// will keep retrying in the background.
		dbLog.error({ err }, 'initial listener connection failed');
	}
}

// ---------------------------------------------------------------------------
// Context: database
// ---------------------------------------------------------------------------

export interface DatabaseContext {
	/** Singleton Prisma client. */
	db: typeof db;
	/** Real-time LISTEN/NOTIFY listener. */
	listener: DatabaseListener;
}

// ---------------------------------------------------------------------------
// Context: actor
// ---------------------------------------------------------------------------

/**
 * Context shape added by {@link actorMiddleware}.
 *
 * Provides the authenticated user's ID, a pre-bound
 * {@link withActorFn} helper for actor-tracked transactions, and a
 * pre-bound {@link abortableFn} helper for cancellable transactions.
 */
export interface ActorContext {
	/**
	 * The authenticated user's CUID, or `null` for unauthenticated
	 * / system requests. Corresponds to the value stored in
	 * `audit.change_log.changed_by` / `audit.deleted_records.deleted_by`.
	 */
	actorId: string | null;

	/**
	 * Wraps a callback in an interactive transaction with actor
	 * context and optional abort support.
	 *
	 * Sets `SET LOCAL app.current_user_id` so the audit triggers
	 * attribute the change to {@link actorId}.
	 *
	 * When {@link actorId} is `null`, the transaction still runs but
	 * no session variable is set — the triggers fall back to
	 * `session_user` (the PostgreSQL role name).
	 *
	 * When a `signal` is provided, the action is raced against the
	 * signal. If the signal fires before the action resolves, the
	 * transaction is rolled back and a `TransactionAbortedError`
	 * is thrown.
	 *
	 * @example
	 * ```ts
	 * // Actor-tracked transaction:
	 * const post = await context.withActor(async (tx) => {
	 *   return tx.post.create({ data });
	 * });
	 * ```
	 *
	 * @example
	 * ```ts
	 * // Actor-tracked + abortable:
	 * const controller = new AbortController();
	 * const post = await context.withActor(async (tx) => {
	 *   return tx.post.create({ data });
	 * }, controller.signal);
	 * ```
	 */
	withActor: <T>(fn: (tx: PrismaClient) => Promise<T>, signal?: AbortSignal) => Promise<T>;

	/**
	 * Wraps a callback in an abortable interactive transaction
	 * **without** actor tracking.
	 *
	 * When the `AbortSignal` fires before the action resolves, Prisma
	 * issues a ROLLBACK and the caller receives a
	 * `TransactionAbortedError`.
	 *
	 * Use this for cancellable read-heavy operations or writes to
	 * non-tracked (ephemeral) tables where actor attribution is not
	 * needed.
	 *
	 * @example
	 * ```ts
	 * const controller = new AbortController();
	 * const stats = await context.abortable(controller.signal, async (tx) => {
	 *   const count = await tx.user.count();
	 *   const records = await tx.user.findMany({ take: 50 });
	 *   return { count, records };
	 * });
	 * ```
	 */
	abortable: <T>(signal: AbortSignal, fn: (tx: PrismaClient) => Promise<T>) => Promise<T>;
}

// ---------------------------------------------------------------------------
// Middleware: database
// ---------------------------------------------------------------------------

/**
 * oRPC middleware that injects `db` and `listener` into the handler
 * context.
 *
 * Because both are process-level singletons initialised at startup,
 * this middleware performs no I/O — it simply forwards the references
 * into the context on each request.
 */
export const databaseMiddleware = os.middleware(async ({ next }) => {
	return next({
		context: {
			db,
			listener
		}
	});
});

// ---------------------------------------------------------------------------
// Middleware: actor
// ---------------------------------------------------------------------------

/**
 * oRPC middleware that injects actor-tracking and abort utilities
 * into the handler context.
 *
 * Must run **after** auth middleware so that `context.user`
 * is available. Reads the user's ID (if authenticated) and provides:
 *
 * - `actorId` — the raw user CUID or `null`.
 * - `withActor(fn, signal?)` — a pre-bound helper that wraps `fn`
 *   in an interactive transaction with `SET LOCAL
 *   app.current_user_id`. Optionally accepts an `AbortSignal` to
 *   make the transaction cancellable.
 * - `abortable(signal, fn)` — a pre-bound helper that wraps `fn`
 *   in an abortable interactive transaction without actor tracking.
 *
 * Route handlers that modify audit-tracked tables should use
 * `context.withActor(fn)` instead of calling data-layer functions
 * with `context.db` directly. This ensures the `changed_by` /
 * `deleted_by` columns in `audit.change_log` and
 * `audit.deleted_records` record the authenticated user's CUID
 * rather than the generic PostgreSQL role name.
 */
export const actorMiddleware = os
	.$context<{ db: DatabaseContext['db']; user: { id: string } | null }>()
	.middleware(async ({ context, next }) => {
		const actorId = context.user?.id ?? null;

		return next({
			context: {
				actorId,
				withActor: <T>(fn: (tx: PrismaClient) => Promise<T>, signal?: AbortSignal): Promise<T> =>
					withActorFn(context.db, actorId, fn, signal),
				abortable: <T>(signal: AbortSignal, fn: (tx: PrismaClient) => Promise<T>): Promise<T> =>
					abortableFn(context.db, signal, fn)
			} satisfies ActorContext
		});
	});
