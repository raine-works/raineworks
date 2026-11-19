/**
 * Dates as people read them.
 *
 * @module lib/format
 */

/** A calendar date (`YYYY-MM-DD`, a release note's) as people read it: "Nov 18, 2026"; `—` for none. */
export const formatPlainDate = (iso: string | null | undefined) =>
	iso
		? Temporal.PlainDate.from(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
		: '—';
