/**
 * Calendar versions, `YEAR.MONTH.N` (`2026.11.1`): comparing them and working
 * out the next. Pure, so pages use it as well as builds (`@raineworks/tools/version`).
 *
 * @module calver
 */

const VERSION = /^(\d{4})\.(\d{1,2})\.(\d+)$/;

/** Whether `value` is a `YEAR.MONTH.N` version. */
export const isVersion = (value: string) => VERSION.test(value);

/** Orders versions oldest first (`sort(compareVersions)`); a non-version sorts first. */
export function compareVersions(a: string, b: string): number {
	const parts = (value: string) => VERSION.exec(value)?.slice(1).map(Number) ?? [0, 0, 0];
	const [x, y] = [parts(a), parts(b)];
	for (let index = 0; index < 3; index++) {
		const difference = (x[index] ?? 0) - (y[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

/** The version after `latest` on `today`: the next in its month, else the month's first. */
export function nextVersion(latest: string | null, today: { year: number; month: number }): string {
	const [year, month, count] = latest ? (VERSION.exec(latest)?.slice(1).map(Number) ?? []) : [];
	if (year === today.year && month === today.month && count) return `${year}.${month}.${count + 1}`;
	return `${today.year}.${today.month}.1`;
}
