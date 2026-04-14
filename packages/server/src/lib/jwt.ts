/**
 * JWT utilities — access-token signing / verification and refresh-token lifecycle.
 *
 * ## Design
 *
 * | Token          | Storage    | TTL     | Purpose                            |
 * |----------------|------------|---------|------------------------------------|
 * | Access token   | Client     | 15 min  | Stateless authn — no DB hit        |
 * | Refresh token  | DB (hash)  | 24 h    | Obtain a new access token silently |
 *
 * Access tokens are compact JWS (HS256) carrying a minimal set of user
 * claims. They are verified by signature alone — no database round-trip.
 *
 * Refresh tokens are cryptographically random opaque strings. The server
 * stores only the SHA-256 hash; the raw value is returned to the client
 * exactly once at issuance. On refresh the client presents the raw token,
 * the server hashes it and looks up the row.
 *
 * Database queries are delegated to the data layer (`data/tokens.ts`).
 * This module owns only the cryptographic operations: signing, hashing,
 * verification, and random generation.
 *
 * @module jwt
 */

import type { PrismaClient } from '@rainestack/database';
import { toDate, toInstant } from '@rainestack/tools/temporal';
import * as tokens from '@server/data/tokens';
import { env } from '@server/lib/env';
import { log } from '@server/lib/logger';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

const jwtLog = log.child({ module: 'jwt' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Access-token lifetime (15 minutes). */
const ACCESS_TOKEN_TTL = Temporal.Duration.from({ minutes: 15 });

/** Refresh-token lifetime (24 hours). */
const REFRESH_TOKEN_TTL = Temporal.Duration.from({ hours: 24 });

/** Number of random bytes used to generate refresh tokens (32 bytes → 64 hex chars). */
const REFRESH_TOKEN_BYTES = 32;

/** HMAC-SHA256 signing key derived from the environment secret. */
const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);

/** Algorithm used for JWS signatures. */
const ALG = 'HS256' as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Claims embedded in every access token.
 *
 * Keep this lean — the payload is sent with every request.
 */
export interface JwtPayload {
	/** Subject — the user's CUID. */
	sub: string;
	/** User email. */
	email: string;
	/** Display name (may be absent). */
	name: string | null;
	/** Avatar URL (may be absent). */
	avatarUrl: string | null;
	/** ISO-8601 timestamp when the email was verified, or `null`. */
	emailVerified: string | null;
	/** User role. */
	role: string;
}

/**
 * Lightweight user object reconstructed from JWT claims.
 */
export interface JwtUser {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
	emailVerified: Date | null;
	role: string;
}

/** Pair returned when tokens are issued (login / refresh). */
export interface TokenPair {
	/** Signed JWT access token. */
	accessToken: string;
	/** ISO-8601 expiry of the access token. */
	accessTokenExpiresAt: string;
	/** Opaque refresh token (raw — not hashed). */
	refreshToken: string;
	/** ISO-8601 expiry of the refresh token. */
	refreshTokenExpiresAt: string;
}

// ---------------------------------------------------------------------------
// Hashing helper
// ---------------------------------------------------------------------------

/**
 * Returns the hex-encoded SHA-256 hash of a string.
 *
 * Used to hash refresh tokens before storing / looking them up in
 * the database so the raw token is never persisted.
 */
async function sha256(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// ---------------------------------------------------------------------------
// Access-token helpers
// ---------------------------------------------------------------------------

/**
 * Signs a new JWT access token for the given user.
 *
 * The token is valid for {@link ACCESS_TOKEN_TTL} and contains just
 * enough information to identify the user and render basic UI without
 * a database query.
 */
export async function signAccessToken(user: {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
	emailVerified: Date | null;
	role: string;
}): Promise<{ token: string; expiresAt: Date }> {
	const nowInstant = Temporal.Now.instant();
	const expiresInstant = nowInstant.add(ACCESS_TOKEN_TTL);
	const iat = Math.floor(nowInstant.epochMilliseconds / 1000);
	const exp = Math.floor(expiresInstant.epochMilliseconds / 1000);
	const expiresAt = toDate(expiresInstant);

	const token = await new SignJWT({
		sub: user.id,
		email: user.email,
		name: user.name ?? null,
		avatarUrl: user.avatarUrl ?? null,
		emailVerified: user.emailVerified?.toISOString() ?? null,
		role: user.role
	} satisfies JwtPayload)
		.setProtectedHeader({ alg: ALG })
		.setIssuedAt(iat)
		.setExpirationTime(exp)
		.sign(SECRET_KEY);

	return { token, expiresAt };
}

/**
 * Verifies a JWT access token and returns the decoded payload.
 *
 * Returns `null` if the token is invalid, expired, or tampered with.
 * **No database query is performed.**
 */
export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
	try {
		const { payload } = await jwtVerify(token, SECRET_KEY, {
			algorithms: [ALG]
		});

		// Ensure the mandatory claims are present.
		if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
			return null;
		}

		return {
			sub: payload.sub,
			email: payload.email as string,
			name: (payload.name as string | null) ?? null,
			avatarUrl: (payload.avatarUrl as string | null) ?? null,
			emailVerified: (payload.emailVerified as string | null) ?? null,
			role: (payload.role as string) ?? 'USER'
		};
	} catch (err) {
		// JWTExpired and JWSSignatureVerificationFailed are expected
		// in normal operation — don't log them.
		if (err instanceof joseErrors.JWTExpired || err instanceof joseErrors.JWSSignatureVerificationFailed) {
			return null;
		}
		// Unexpected verification error — log but still treat as invalid.
		jwtLog.error({ err }, 'unexpected verification error');
		return null;
	}
}

/**
 * Converts a verified {@link JwtPayload} into the {@link JwtUser}
 * shape that handlers expect.
 */
export function payloadToUser(payload: JwtPayload): JwtUser {
	return {
		id: payload.sub,
		email: payload.email,
		name: payload.name,
		avatarUrl: payload.avatarUrl,
		emailVerified: payload.emailVerified ? new Date(payload.emailVerified) : null,
		role: payload.role
	};
}

// ---------------------------------------------------------------------------
// Refresh-token helpers
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random refresh token.
 */
function generateRefreshToken(): string {
	const bytes = new Uint8Array(REFRESH_TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Creates a refresh token for the given user, stores its hash in the
 * database, and returns the **raw** token (to be sent to the client
 * exactly once).
 */
export async function createRefreshToken(
	db: Db,
	actorId: string | null,
	userId: string,
	opts?: { ipAddress?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
	const raw = generateRefreshToken();
	const hash = await sha256(raw);
	const expiresAt = toDate(Temporal.Now.instant().add(REFRESH_TOKEN_TTL));

	await tokens.create(db, actorId, {
		hash,
		expiresAt,
		userId,
		ipAddress: opts?.ipAddress,
		userAgent: opts?.userAgent
	});

	return { token: raw, expiresAt };
}

/**
 * Validates a raw refresh token and returns the associated user, or
 * `null` if the token is invalid, expired, or revoked.
 *
 * Expired or revoked tokens are **not** deleted — they are kept for
 * audit purposes. Callers should rely on the `null` return to reject
 * the request.
 */
export async function validateRefreshToken(db: Db, rawToken: string) {
	const hash = await sha256(rawToken);
	const record = await tokens.findByHash(db, hash);

	if (!record) return null;

	// Revoked or expired.
	if (record.revokedAt || Temporal.Instant.compare(toInstant(record.expiresAt), Temporal.Now.instant()) < 0) {
		return null;
	}

	return record;
}

/**
 * Revokes a single refresh token (logout current device).
 */
export async function revokeRefreshToken(db: Db, actorId: string | null, rawToken: string): Promise<void> {
	const hash = await sha256(rawToken);
	await tokens.revokeByHash(db, actorId, hash);
}

/**
 * Revokes **all** refresh tokens for a user (logout everywhere).
 */
export async function revokeAllRefreshTokens(db: Db, actorId: string | null, userId: string): Promise<void> {
	await tokens.revokeAllForUser(db, actorId, userId);
}

/**
 * Rotates a refresh token: revokes the old one and issues a new one
 * in a single transaction. Returns the new raw token and its expiry.
 *
 * Rotation limits the window of abuse if a refresh token is leaked —
 * once the legitimate client uses the old token, the attacker's copy
 * becomes invalid.
 */
export async function rotateRefreshToken(
	db: Db,
	actorId: string | null,
	oldRawToken: string,
	userId: string,
	opts?: { ipAddress?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
	const oldHash = await sha256(oldRawToken);
	const newRaw = generateRefreshToken();
	const newHash = await sha256(newRaw);
	const expiresAt = toDate(Temporal.Now.instant().add(REFRESH_TOKEN_TTL));

	await tokens.rotate(db, actorId, oldHash, {
		hash: newHash,
		expiresAt,
		userId,
		ipAddress: opts?.ipAddress,
		userAgent: opts?.userAgent
	});

	return { token: newRaw, expiresAt };
}

/**
 * Issues a complete token pair (access + refresh) for the given user.
 *
 * Convenience wrapper used after OTP verification, OIDC callback,
 * passkey authentication, and during token refresh with rotation.
 */
export async function issueTokenPair(
	db: Db,
	actorId: string | null,
	user: {
		id: string;
		email: string;
		name: string | null;
		avatarUrl: string | null;
		emailVerified: Date | null;
		role: string;
	},
	opts?: { ipAddress?: string; userAgent?: string }
): Promise<TokenPair> {
	const [access, refresh] = await Promise.all([signAccessToken(user), createRefreshToken(db, actorId, user.id, opts)]);

	return {
		accessToken: access.token,
		accessTokenExpiresAt: access.expiresAt.toISOString(),
		refreshToken: refresh.token,
		refreshTokenExpiresAt: refresh.expiresAt.toISOString()
	};
}
