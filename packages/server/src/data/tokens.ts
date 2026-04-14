/**
 * Refresh token data access.
 *
 * Pure query functions for the `RefreshToken` table. Cryptographic
 * concerns (hashing, random generation) live in `lib/jwt.ts` — this
 * module is concerned only with reading and writing rows.
 *
 * All mutation functions accept an `actorId` parameter and wrap their
 * operations in {@link withActor} so audit triggers attribute changes
 * to the correct user. Because `withActor` is nestable (it passes
 * through when `db` is already a transaction client), these functions
 * work both standalone and when composed inside a larger transaction.
 *
 * All functions that accept a token value expect the **hashed** form
 * (SHA-256 hex). The raw token never reaches the data layer.
 *
 * @module data/tokens
 */

import type { PrismaClient } from '@rainestack/database';
import { withActor } from '@rainestack/database/actor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Finds a refresh token by its SHA-256 hash and includes the
 * associated user.
 *
 * Returns `null` when no matching token exists. Callers are
 * responsible for checking `revokedAt` and `expiresAt`.
 */
export async function findByHash(db: Db, hash: string) {
	return db.refreshToken.findUnique({
		where: { token: hash },
		include: { user: true }
	});
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Persists a new refresh token row.
 *
 * The `hash` is the SHA-256 hex digest of the raw token that was
 * sent to the client. The raw value is never stored.
 */
export async function create(
	db: Db,
	actorId: string | null,
	data: {
		hash: string;
		expiresAt: Date;
		userId: string;
		ipAddress?: string;
		userAgent?: string;
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.refreshToken.create({
			data: {
				token: data.hash,
				expiresAt: data.expiresAt,
				userId: data.userId,
				ipAddress: data.ipAddress ?? null,
				userAgent: data.userAgent ?? null
			}
		});
	});
}

/**
 * Revokes a single refresh token identified by its hash.
 *
 * Uses `updateMany` so the operation is a no-op (rather than an
 * error) when the token is already revoked or does not exist.
 */
export async function revokeByHash(db: Db, actorId: string | null, hash: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.refreshToken.updateMany({
			where: { token: hash, revokedAt: null },
			data: { revokedAt: new Date() }
		});
	});
}

/**
 * Revokes **all** active refresh tokens for a user (logout everywhere).
 */
export async function revokeAllForUser(db: Db, actorId: string | null, userId: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.refreshToken.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt: new Date() }
		});
	});
}

/**
 * Revokes an existing refresh token and creates a new one.
 *
 * Used during token rotation — the old token is invalidated and a
 * fresh one is issued so that a leaked token can only be used once.
 *
 * Callers are expected to wrap this in a `withActor` transaction so
 * both operations are atomic. The function itself uses individual
 * queries (rather than `$transaction`) so it can accept either the
 * singleton client or a transaction client from `withActor`.
 */
export async function rotate(
	db: Db,
	actorId: string | null,
	oldHash: string,
	newData: {
		hash: string;
		expiresAt: Date;
		userId: string;
		ipAddress?: string;
		userAgent?: string;
	}
) {
	return withActor(db, actorId, async (tx) => {
		await tx.refreshToken.updateMany({
			where: { token: oldHash, revokedAt: null },
			data: { revokedAt: new Date() }
		});

		return tx.refreshToken.create({
			data: {
				token: newData.hash,
				expiresAt: newData.expiresAt,
				userId: newData.userId,
				ipAddress: newData.ipAddress ?? null,
				userAgent: newData.userAgent ?? null
			}
		});
	});
}
