/**
 * Passkey and challenge data access.
 *
 * Pure query functions for the `Passkey` and `PasskeyChallenge`
 * tables. WebAuthn ceremony logic (attestation/assertion verification,
 * challenge generation) lives in `lib/passkeys.ts` — this module is
 * concerned only with reading and writing rows.
 *
 * All mutation functions accept an `actorId` parameter and wrap their
 * operations in {@link withActor} so audit triggers attribute changes
 * to the correct user. Because `withActor` is nestable (it passes
 * through when `db` is already a transaction client), these functions
 * work both standalone and when composed inside a larger transaction.
 *
 * @module data/passkeys
 */

import type { PrismaClient } from '@rainestack/database';
import { withActor } from '@rainestack/database/actor';
import { toDate } from '@rainestack/tools/temporal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

// ===========================================================================
// Passkey — registered WebAuthn credentials
// ===========================================================================

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Finds a passkey by its Base64url-encoded credential ID.
 *
 * This is the primary lookup during the authentication ceremony —
 * the browser sends the credential ID selected by the authenticator,
 * and the server matches it to a stored public key.
 *
 * Includes the associated `User` so the caller can issue a JWT
 * without an extra query.
 */
export async function findByCredentialId(db: Db, credentialId: string) {
	return db.passkey.findUnique({
		where: { credentialId },
		include: { user: true }
	});
}

/**
 * Returns all registered passkeys for a user.
 *
 * Used on the account settings page to show enrolled authenticators
 * and on the authentication ceremony to build the `allowCredentials`
 * list.
 */
export async function findByUserId(db: Db, userId: string) {
	return db.passkey.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' }
	});
}

/**
 * Finds a passkey by its CUID.
 *
 * Returns `null` when no passkey with the given ID exists.
 */
export async function findById(db: Db, id: string) {
	return db.passkey.findUnique({
		where: { id },
		include: { user: true }
	});
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Stores a newly registered WebAuthn credential.
 *
 * Called after the registration ceremony succeeds — the attestation
 * response has been verified and the public key extracted by the
 * lib layer.
 */
export async function create(
	db: Db,
	actorId: string | null,
	data: {
		userId: string;
		credentialId: string;
		publicKey: Uint8Array;
		counter: number;
		transports: string[];
		aaguid?: string;
		credentialDeviceType: string;
		credentialBackedUp: boolean;
		name?: string;
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.passkey.create({
			data: {
				userId: data.userId,
				credentialId: data.credentialId,
				publicKey: new Uint8Array(data.publicKey) as Uint8Array<ArrayBuffer>,
				counter: data.counter,
				transports: data.transports,
				aaguid: data.aaguid ?? null,
				credentialDeviceType: data.credentialDeviceType,
				credentialBackedUp: data.credentialBackedUp,
				name: data.name ?? 'My passkey'
			}
		});
	});
}

/**
 * Updates the signature counter and last-used timestamp after a
 * successful authentication.
 *
 * The counter is used for clone detection — if the stored counter
 * is greater than or equal to the counter in the assertion, the
 * authenticator may have been cloned.
 */
export async function updateCounter(db: Db, actorId: string | null, id: string, counter: number) {
	return withActor(db, actorId, async (tx) => {
		return tx.passkey.update({
			where: { id },
			data: {
				counter,
				lastUsedAt: toDate(Temporal.Now.instant())
			}
		});
	});
}

/**
 * Renames a passkey.
 *
 * Allows the user to assign a human-readable label (e.g. "MacBook
 * Touch ID", "YubiKey 5") to distinguish multiple enrolled
 * authenticators.
 */
export async function rename(db: Db, actorId: string | null, id: string, name: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.passkey.update({
			where: { id },
			data: { name }
		});
	});
}

/**
 * Removes a registered passkey.
 *
 * The caller is responsible for ensuring the user has at least one
 * other authentication method (another passkey, a linked OIDC
 * account, or a verified email for OTP) before allowing removal.
 */
export async function remove(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.passkey.delete({ where: { id } });
	});
}

/**
 * Counts the number of registered passkeys for a user.
 *
 * Used to prevent the user from removing their last authentication
 * method.
 */
export async function countByUserId(db: Db, userId: string) {
	return db.passkey.count({ where: { userId } });
}

// ===========================================================================
// PasskeyChallenge — ephemeral WebAuthn ceremony challenges
// ===========================================================================

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Finds a challenge by its Base64url-encoded value.
 *
 * This is the lookup used during both registration and authentication
 * ceremonies — the client sends back the challenge it received, and
 * the server verifies it matches a stored, unexpired, unused row.
 */
export async function findChallengeByValue(db: Db, challenge: string) {
	return db.passkeyChallenge.findUnique({
		where: { challenge }
	});
}

/**
 * Finds a challenge by its CUID.
 */
export async function findChallengeById(db: Db, id: string) {
	return db.passkeyChallenge.findUnique({
		where: { id }
	});
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Persists a new WebAuthn challenge.
 *
 * The `type` field indicates whether this challenge is for a
 * `"registration"` or `"authentication"` ceremony.
 *
 * The `userId` is nullable — discoverable credential (resident key)
 * authentication flows don't know the user upfront, so the challenge
 * is created without a user association.
 */
export async function createChallenge(
	db: Db,
	actorId: string | null,
	data: {
		challenge: string;
		type: 'registration' | 'authentication';
		expiresAt: Date;
		userId?: string;
	}
) {
	return withActor(db, actorId, async (tx) => {
		return tx.passkeyChallenge.create({
			data: {
				challenge: data.challenge,
				type: data.type,
				expiresAt: data.expiresAt,
				userId: data.userId ?? null
			}
		});
	});
}

/**
 * Marks a challenge as successfully used by setting `usedAt` to the
 * current timestamp. A used challenge cannot be verified again.
 */
export async function markChallengeUsed(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.passkeyChallenge.update({
			where: { id },
			data: { usedAt: toDate(Temporal.Now.instant()) }
		});
	});
}

/**
 * Deletes all challenges that have expired or been used.
 *
 * Intended to be called periodically (e.g. via a cron job) to keep
 * the `PasskeyChallenge` table from growing unboundedly. Challenges
 * are short-lived (typically 5 minutes) so aggressive cleanup is
 * safe.
 *
 * @returns The number of deleted rows.
 */
export async function deleteExpiredChallenges(db: Db, actorId: string | null) {
	return withActor(db, actorId, async (tx) => {
		const now = toDate(Temporal.Now.instant());

		const { count } = await tx.passkeyChallenge.deleteMany({
			where: {
				OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }]
			}
		});

		return count;
	});
}
