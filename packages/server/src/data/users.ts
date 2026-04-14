/**
 * User data-access layer.
 *
 * Pure database operations for the `User` model. Every function accepts
 * a `db` parameter (either the singleton client or a transaction client)
 * so callers can compose them inside actor-tracked transactions.
 *
 * All mutation functions accept an `actorId` parameter and wrap their
 * operations in {@link withActor} so audit triggers attribute changes
 * to the correct user. Because `withActor` is nestable (it passes
 * through when `db` is already a transaction client), these functions
 * work both standalone and when composed inside a larger transaction.
 *
 * No authorization logic lives here — that belongs in the route handlers.
 *
 * @module data/users
 */

import type { Prisma } from '@database/generated/prisma/client';
import type { PrismaClient } from '@rainestack/database';
import { withActor } from '@rainestack/database/actor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

export interface ListUsersOptions {
	page?: number;
	limit?: number;
	role?: 'USER' | 'ADMIN';
	search?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch a single user by ID, or `null` if not found. */
export async function findById(db: Db, id: string) {
	return db.user.findUnique({ where: { id } });
}

/** Fetch a single user by email, or `null` if not found. */
export async function findByEmail(db: Db, email: string) {
	return db.user.findUnique({ where: { email } });
}

/**
 * Returns the first user found (no ordering guarantee).
 *
 * This is a scaffold convenience — real applications should always
 * look up users by a meaningful identifier.
 */
export async function findFirst(db: Db) {
	return db.user.findFirst();
}

/** Paginated user listing with optional role filter and search. */
export async function list(db: Db, options: ListUsersOptions = {}) {
	const { page = 1, limit = 20, role, search } = options;
	const skip = (page - 1) * limit;

	const where: Prisma.UserWhereInput = {};

	if (role) {
		where.role = role;
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ email: { contains: search, mode: 'insensitive' } }
		];
	}

	const [users, total] = await Promise.all([
		db.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' }
		}),
		db.user.count({ where })
	]);

	return {
		users,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		}
	};
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new user. */
export async function create(
	db: Db,
	actorId: string | null,
	data: {
		email: string;
		name?: string | null;
		avatarUrl?: string | null;
		emailVerified?: Date;
		role?: 'USER' | 'ADMIN';
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.user.create({
			data: {
				email: data.email,
				name: data.name,
				avatarUrl: data.avatarUrl,
				emailVerified: data.emailVerified ?? null,
				role: data.role ?? 'USER'
			}
		});
	});
}

/** Update an existing user by ID. Returns the updated user. */
export async function update(
	db: Db,
	actorId: string | null,
	id: string,
	data: {
		name?: string;
		avatarUrl?: string | null;
		role?: 'USER' | 'ADMIN';
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.user.update({
			where: { id },
			data
		});
	});
}

/**
 * Marks a user's email as verified by setting `emailVerified` to now.
 *
 * Used during OIDC and passkey authentication flows where the
 * provider or device has already verified the user's identity.
 */
export async function markEmailVerified(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.user.update({
			where: { id },
			data: { emailVerified: new Date() }
		});
	});
}

/** Delete a user by ID. Returns the deleted user. */
export async function remove(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.user.delete({ where: { id } });
	});
}

/** Count all users, optionally filtered by role. */
export async function count(db: Db, role?: 'USER' | 'ADMIN') {
	return db.user.count({
		where: role ? { role } : undefined
	});
}

/**
 * Creates or updates a user after a successful email verification.
 *
 * - **New user** (sign-up): creates a row with `emailVerified` set
 *   to the current timestamp.
 * - **Existing user** (login): updates `emailVerified` to the
 *   current timestamp (re-confirmation).
 *
 * Returns the full user row in both cases.
 */
export async function upsertOnVerification(db: Db, actorId: string | null, email: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.user.upsert({
			where: { email },
			create: { email, emailVerified: new Date() },
			update: { emailVerified: new Date() }
		});
	});
}
