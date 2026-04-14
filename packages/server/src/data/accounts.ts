/**
 * OIDC account data access.
 *
 * Pure query functions for the `Account` table. Each row links an
 * external identity provider account (Google, GitHub, etc.) to a
 * local `User` via the OIDC federated identity model.
 *
 * All mutation functions accept an `actorId` parameter and wrap their
 * operations in {@link withActor} so audit triggers attribute changes
 * to the correct user. Because `withActor` is nestable (it passes
 * through when `db` is already a transaction client), these functions
 * work both standalone and when composed inside a larger transaction.
 *
 * Token management (encryption, refresh) and provider-specific logic
 * live in `lib/oidc.ts` — this module is concerned only with reading
 * and writing rows.
 *
 * @module data/accounts
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
 * Finds an account by provider + provider account ID.
 *
 * This is the primary lookup used during the OIDC callback — the
 * `sub` claim from the provider's id_token is matched against
 * `providerAccountId` to find the local account link.
 *
 * Includes the associated `User` so the caller can issue a JWT
 * without an extra query.
 */
export async function findByProviderAccount(db: Db, provider: string, providerAccountId: string) {
	return db.account.findUnique({
		where: { provider_providerAccountId: { provider, providerAccountId } },
		include: { user: true }
	});
}

/**
 * Returns all linked accounts for a user.
 *
 * Used on the account settings page to show which providers are
 * connected and allow the user to unlink them.
 */
export async function findByUserId(db: Db, userId: string) {
	return db.account.findMany({
		where: { userId },
		orderBy: { createdAt: 'asc' }
	});
}

/**
 * Finds a single account by its CUID.
 *
 * Returns `null` when no account with the given ID exists.
 */
export async function findById(db: Db, id: string) {
	return db.account.findUnique({
		where: { id },
		include: { user: true }
	});
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Links an external provider account to a local user.
 *
 * Called after a successful OIDC callback when the provider's `sub`
 * claim is not yet associated with any local user. The tokens
 * received from the provider are stored so we can call provider APIs
 * on behalf of the user if needed.
 */
export async function linkAccount(
	db: Db,
	actorId: string | null,
	data: {
		userId: string;
		provider: string;
		providerAccountId: string;
		accessToken?: string;
		refreshToken?: string;
		accessTokenExpiresAt?: Date;
		tokenType?: string;
		scope?: string;
		idToken?: string;
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.account.create({
			data: {
				userId: data.userId,
				provider: data.provider,
				providerAccountId: data.providerAccountId,
				accessToken: data.accessToken ?? null,
				refreshToken: data.refreshToken ?? null,
				accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
				tokenType: data.tokenType ?? null,
				scope: data.scope ?? null,
				idToken: data.idToken ?? null
			},
			include: { user: true }
		});
	});
}

/**
 * Updates the stored tokens for an existing provider account.
 *
 * Called when the user re-authenticates with a provider and the
 * server receives a fresh set of tokens. This keeps the stored
 * tokens current so provider API calls continue to work.
 */
export async function updateTokens(
	db: Db,
	actorId: string | null,
	id: string,
	data: {
		accessToken?: string | null;
		refreshToken?: string | null;
		accessTokenExpiresAt?: Date | null;
		tokenType?: string | null;
		scope?: string | null;
		idToken?: string | null;
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.account.update({
			where: { id },
			data,
			include: { user: true }
		});
	});
}

/**
 * Unlinks an external provider account from a user.
 *
 * The caller is responsible for ensuring the user has at least one
 * other authentication method (another linked account, a passkey,
 * or a verified email for OTP) before allowing the unlink.
 */
export async function unlinkAccount(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.account.delete({ where: { id } });
	});
}

/**
 * Counts the number of linked accounts for a user.
 *
 * Used to prevent the user from unlinking their last authentication
 * method — at least one account, passkey, or verified email must
 * remain.
 */
export async function countByUserId(db: Db, userId: string) {
	return db.account.count({ where: { userId } });
}
