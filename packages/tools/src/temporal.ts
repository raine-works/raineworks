/**
 * Prisma ↔ Temporal bridge and serialisation utilities.
 *
 * Prisma returns native `Date` objects for all `DateTime` columns.
 * These helpers convert between `Date` and `Temporal.Instant` at the
 * persistence boundary so application code can work with the Temporal
 * API exclusively.
 *
 * Serialisation helpers convert `Date` values into ISO-8601 strings
 * suitable for API responses. All timestamps are UTC — no timezone
 * conversion is performed on the server.
 *
 * **Polyfill-agnostic** — every function references `globalThis.Temporal`
 * (provided today by `temporal-polyfill/global`, loaded at each entry
 * point via `@rainestack/tools/temporal-polyfill`). When runtimes ship
 * native Temporal, these utilities continue to work with zero changes.
 *
 * @module temporal
 */

// ---------------------------------------------------------------------------
// Server-side: Prisma ↔ Temporal conversion
// ---------------------------------------------------------------------------

/** Convert a Prisma `Date` to a `Temporal.Instant`. */
export function toInstant(date: Date): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}

/** Convert a `Temporal.Instant` to a `Date` (for Prisma writes). */
export function toDate(instant: Temporal.Instant): Date {
	return new Date(instant.epochMilliseconds);
}

// ---------------------------------------------------------------------------
// Server-side: Serialisation (Date → ISO-8601 UTC string for API responses)
// ---------------------------------------------------------------------------

/** Serialise a Prisma `Date` to an ISO-8601 UTC instant string. */
export function toISO(date: Date): string {
	return toInstant(date).toString();
}

/** Serialise an optional Prisma `Date` to ISO-8601 UTC or `null`. */
export function toISOOrNull(date: Date | null | undefined): string | null {
	return date ? toISO(date) : null;
}
