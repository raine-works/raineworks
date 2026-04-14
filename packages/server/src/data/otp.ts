/**
 * OTP code data access.
 *
 * Pure query functions for the `OtpCode` table. Business logic
 * (rate-limiting decisions, expiry/attempt validation, code
 * generation) lives in `lib/otp.ts` — this module is concerned
 * only with reading and writing rows.
 *
 * All mutation functions accept an `actorId` parameter and wrap their
 * operations in {@link withActor} so audit triggers attribute changes
 * to the correct user. Because `withActor` is nestable (it passes
 * through when `db` is already a transaction client), these functions
 * work both standalone and when composed inside a larger transaction.
 *
 * @module data/otp
 */

import type { PrismaClient } from '@rainestack/database';
import { withActor } from '@rainestack/database/actor';
import { toDate } from '@rainestack/tools/temporal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns the most recently created OTP code for the given email,
 * regardless of whether it has been used or has expired.
 *
 * Used by the rate-limiter to enforce a minimum delay between
 * consecutive code requests for the same address.
 */
export async function findLatestByEmail(db: Db, email: string) {
	return db.otpCode.findFirst({
		where: { email },
		orderBy: { createdAt: 'desc' }
	});
}

/**
 * Returns the most recent **unused** OTP code for the given email.
 *
 * Used during verification — only codes that have not yet been
 * consumed (`usedAt IS NULL`) are considered.
 */
export async function findLatestUnusedByEmail(db: Db, email: string) {
	return db.otpCode.findFirst({
		where: { email, usedAt: null },
		orderBy: { createdAt: 'desc' }
	});
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Persists a new OTP code.
 *
 * The `userId` is nullable because the code may be issued before a
 * `User` record exists (initial sign-up flow).
 */
export async function create(
	db: Db,
	actorId: string | null,
	data: {
		email: string;
		code: string;
		expiresAt: Date;
		userId?: string;
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.otpCode.create({
			data: {
				email: data.email,
				code: data.code,
				expiresAt: data.expiresAt,
				userId: data.userId ?? null
			}
		});
	});
}

/**
 * Increments the failed-attempt counter on an OTP code.
 *
 * Called when the user submits an incorrect code so the system
 * can enforce a maximum-attempts lockout.
 */
export async function incrementAttempts(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.otpCode.update({
			where: { id },
			data: { attempts: { increment: 1 } }
		});
	});
}

/**
 * Marks an OTP code as successfully used by setting `usedAt` to the
 * current timestamp. A used code cannot be verified again.
 */
export async function markUsed(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.otpCode.update({
			where: { id },
			data: { usedAt: toDate(Temporal.Now.instant()) }
		});
	});
}

/**
 * Deletes all OTP codes that are expired or were used before the
 * given cutoff timestamp.
 *
 * Intended to be called periodically (e.g. via a cron job) to keep
 * the `OtpCode` table from growing unboundedly.
 *
 * @returns The number of deleted rows.
 */
export async function deleteExpired(db: Db, actorId: string | null, usedBeforeCutoff: Date) {
	return withActor(db, actorId, async (tx) => {
		const { count } = await tx.otpCode.deleteMany({
			where: {
				OR: [
					{ expiresAt: { lt: toDate(Temporal.Now.instant()) } },
					{ usedAt: { not: null }, createdAt: { lt: usedBeforeCutoff } }
				]
			}
		});

		return count;
	});
}
