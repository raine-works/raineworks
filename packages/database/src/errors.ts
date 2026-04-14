/**
 * Prisma error utilities.
 *
 * Provides type-safe helpers for identifying and extracting
 * information from common Prisma client errors. Consumers use these
 * in `catch` blocks to map database constraint violations and
 * missing-record errors into domain-appropriate responses.
 *
 * This module is deliberately framework-agnostic — it knows about
 * Prisma error codes but not about HTTP status codes or oRPC. The
 * mapping from {@link uniqueViolation} / {@link recordNotFound} to
 * an API error is the caller's responsibility.
 *
 * @example
 * ```ts
 * import { uniqueViolation, recordNotFound } from '@rainestack/database/errors';
 *
 * try {
 *   return await postsData.create(db, actorId, data);
 * } catch (error) {
 *   const violation = uniqueViolation(error);
 *   if (violation) {
 *     throw new ORPCError('CONFLICT', {
 *       message: `Duplicate value for ${violation.fields.join(', ')}`
 *     });
 *   }
 *   if (recordNotFound(error)) {
 *     throw new ORPCError('NOT_FOUND', { message: 'Record not found' });
 *   }
 *   throw error;
 * }
 * ```
 *
 * @module errors
 */

import { Prisma } from '@database/generated/prisma/client';

// ---------------------------------------------------------------------------
// Prisma error codes
// ---------------------------------------------------------------------------

/**
 * Unique constraint violation.
 *
 * Thrown when an `INSERT` or `UPDATE` would create a duplicate value
 * on a column (or set of columns) covered by a unique index.
 *
 * `meta.target` contains the constraint field name(s).
 */
const P2002 = 'P2002' as const;

/**
 * Record not found.
 *
 * Thrown when an operation that requires an existing record
 * (`update`, `delete`, `findUniqueOrThrow`, etc.) cannot locate
 * one matching the provided `where` clause.
 *
 * `meta.modelName` contains the Prisma model name and
 * `meta.cause` contains a human-readable description.
 */
const P2025 = 'P2025' as const;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `error` is a Prisma client error with a known
 * request error code (e.g. `P2002`, `P2025`).
 *
 * Use this as a general-purpose type guard before inspecting
 * `error.code` or `error.meta` manually. For the two most common
 * cases prefer the more specific {@link uniqueViolation} and
 * {@link recordNotFound} helpers.
 */
export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
	return error instanceof Prisma.PrismaClientKnownRequestError;
}

// ---------------------------------------------------------------------------
// Unique constraint violation (P2002)
// ---------------------------------------------------------------------------

/** Information extracted from a P2002 unique constraint violation. */
export interface UniqueViolationInfo {
	/**
	 * The database column(s) that caused the conflict.
	 *
	 * Prisma populates this from the constraint's column list.
	 * For single-column unique indexes this is a one-element array
	 * (e.g. `['email']`); for composite indexes it lists every
	 * column in the constraint (e.g. `['provider', 'providerAccountId']`).
	 */
	fields: string[];
}

/**
 * If `error` is a Prisma P2002 unique constraint violation, returns
 * the constraint field(s). Otherwise returns `null`.
 *
 * @example
 * ```ts
 * const violation = uniqueViolation(error);
 * if (violation) {
 *   // violation.fields === ['slug']
 *   throw new ORPCError('CONFLICT', {
 *     message: `A record with that ${violation.fields[0]} already exists`
 *   });
 * }
 * ```
 */
export function uniqueViolation(error: unknown): UniqueViolationInfo | null {
	if (!isPrismaError(error) || error.code !== P2002) {
		return null;
	}

	const target = error.meta?.target;
	const fields: string[] = Array.isArray(target) ? target : [];

	return { fields };
}

// ---------------------------------------------------------------------------
// Record not found (P2025)
// ---------------------------------------------------------------------------

/** Information extracted from a P2025 record-not-found error. */
export interface RecordNotFoundInfo {
	/** The Prisma model name (e.g. `'Post'`, `'User'`), if available. */
	model: string | undefined;
	/** A human-readable description of why the record was not found. */
	cause: string | undefined;
}

/**
 * If `error` is a Prisma P2025 record-not-found error, returns
 * contextual information about the missing record. Otherwise
 * returns `null`.
 *
 * @example
 * ```ts
 * const notFound = recordNotFound(error);
 * if (notFound) {
 *   // notFound.model === 'Post'
 *   throw new ORPCError('NOT_FOUND', {
 *     message: `${notFound.model ?? 'Record'} not found`
 *   });
 * }
 * ```
 */
export function recordNotFound(error: unknown): RecordNotFoundInfo | null {
	if (!isPrismaError(error) || error.code !== P2025) {
		return null;
	}

	return {
		model: error.meta?.modelName as string | undefined,
		cause: error.meta?.cause as string | undefined
	};
}
