/**
 * One-time passcode (OTP) generation and verification.
 *
 * Implements a passwordless authentication flow where a short-lived,
 * single-use numeric code is sent to a user's email address. The code
 * is stored in the `OtpCode` table and validated against expiry,
 * attempt limits, and prior usage.
 *
 * Database queries are delegated to the data layer (`data/otp.ts`).
 * This module owns only the business logic: rate-limiting, code
 * generation, and verification state machine.
 *
 * @module otp
 */

import { ORPCError } from '@orpc/server';
import type { PrismaClient } from '@rainestack/database';
import { toDate, toInstant } from '@rainestack/tools/temporal';
import * as otpData from '@server/data/otp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of digits in the generated OTP code. */
const OTP_LENGTH = 6;

/** How long an OTP remains valid (10 minutes). */
const OTP_TTL = Temporal.Duration.from({ minutes: 10 });

/** Maximum number of failed verification attempts before the code is locked out. */
const MAX_ATTEMPTS = 5;

/**
 * Minimum delay between issuing new OTP codes to the same email
 * (60 seconds). Prevents spam / abuse.
 */
const RATE_LIMIT = Temporal.Duration.from({ seconds: 60 });

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random numeric OTP code.
 *
 * Uses `crypto.getRandomValues` (available in Bun natively) to produce
 * a random integer, then zero-pads it to the desired length.
 */
function generateCode(): string {
	const max = 10 ** OTP_LENGTH;
	const bytes = new Uint32Array(1);
	crypto.getRandomValues(bytes);
	const numeric = bytes[0] % max;
	return numeric.toString().padStart(OTP_LENGTH, '0');
}

// ---------------------------------------------------------------------------
// OTP lifecycle
// ---------------------------------------------------------------------------

export interface CreateOtpResult {
	/** The generated OTP code (caller is responsible for delivering it). */
	code: string;
	/** When the code expires. */
	expiresAt: Date;
}

/**
 * Creates a new OTP code for the given email address.
 *
 * If a `userId` is provided (i.e. the email belongs to an existing
 * user), the code is linked to that user for audit purposes. For new
 * sign-ups the code is created without a user association.
 *
 * Rate-limits issuance to one code per email per {@link RATE_LIMIT}
 * window.
 *
 * @throws {ORPCError} TOO_MANY_REQUESTS if a code was issued too recently.
 */
export async function createOtp(
	db: Db,
	actorId: string | null,
	email: string,
	userId?: string
): Promise<CreateOtpResult> {
	// -----------------------------------------------------------------------
	// Rate-limit: reject if the most recent code for this email is too fresh.
	// -----------------------------------------------------------------------
	const recent = await otpData.findLatestByEmail(db, email);

	if (recent) {
		const elapsed = Temporal.Now.instant().since(toInstant(recent.createdAt));
		if (Temporal.Duration.compare(elapsed, RATE_LIMIT) < 0) {
			throw new ORPCError('TOO_MANY_REQUESTS', {
				message: 'An OTP code was sent recently. Please wait before requesting another.'
			});
		}
	}

	// -----------------------------------------------------------------------
	// Generate and persist
	// -----------------------------------------------------------------------
	const code = generateCode();
	const expiresAt = toDate(Temporal.Now.instant().add(OTP_TTL));

	await otpData.create(db, actorId, { email, code, expiresAt, userId });

	return { code, expiresAt };
}

export type VerifyOtpResult =
	| { success: true; email: string; userId: string | null }
	| { success: false; reason: string };

/**
 * Verifies an OTP code submitted by the user.
 *
 * Performs the following checks in order:
 * 1. A matching code exists for the given email.
 * 2. The code has not already been used.
 * 3. The code has not expired.
 * 4. The maximum attempt count has not been exceeded.
 *
 * On failure the attempt counter is incremented. On success the code
 * is marked as used (`usedAt` is set) so it cannot be replayed.
 */
export async function verifyOtp(db: Db, actorId: string | null, email: string, code: string): Promise<VerifyOtpResult> {
	// Find the most recent unused code for this email.
	const otp = await otpData.findLatestUnusedByEmail(db, email);

	if (!otp) {
		return { success: false, reason: 'No pending OTP code found for this email.' };
	}

	// Already used (defensive — the query filters this, but just in case).
	if (otp.usedAt) {
		return { success: false, reason: 'This OTP code has already been used.' };
	}

	// Expired.
	if (Temporal.Instant.compare(toInstant(otp.expiresAt), Temporal.Now.instant()) < 0) {
		return { success: false, reason: 'This OTP code has expired. Please request a new one.' };
	}

	// Too many failed attempts.
	if (otp.attempts >= MAX_ATTEMPTS) {
		return { success: false, reason: 'Too many failed attempts. Please request a new code.' };
	}

	// Code mismatch — increment attempts and reject.
	if (otp.code !== code) {
		await otpData.incrementAttempts(db, actorId, otp.id);
		return { success: false, reason: 'Invalid code. Please try again.' };
	}

	// -----------------------------------------------------------------------
	// Success — mark as used
	// -----------------------------------------------------------------------
	await otpData.markUsed(db, actorId, otp.id);

	return { success: true, email: otp.email, userId: otp.userId };
}

/**
 * Deletes all expired or used OTP codes older than the given age.
 *
 * Intended to be called periodically (e.g. via a cron job) to keep
 * the `OtpCode` table from growing unboundedly.
 *
 * @param maxAgeMs - Maximum age of codes to retain (defaults to 24 hours).
 * @returns The number of deleted rows.
 */
export async function pruneOtpCodes(
	db: Db,
	actorId: string | null,
	maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<number> {
	const cutoff = toDate(Temporal.Now.instant().subtract(Temporal.Duration.from({ milliseconds: maxAgeMs })));
	return otpData.deleteExpired(db, actorId, cutoff);
}
