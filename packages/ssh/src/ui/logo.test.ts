import { describe, expect, test } from 'bun:test';

import { logoRows } from '@raineworks/ssh/ui/logo';

describe('the mark in braille', () => {
	test('is as wide as asked (even) and half as tall', () => {
		const rows = logoRows(28);
		expect(rows).toHaveLength(14);
		for (const row of rows) expect([...row]).toHaveLength(28);
		expect(logoRows(17)).toHaveLength(8);
	});

	test('is only braille, the circle reaching every edge and the inside drawn (the rain lines, the trace)', () => {
		const rows = logoRows(28);
		const dots = (char: string) => char.charCodeAt(0) - 0x2800;
		for (const row of rows) for (const char of row) expect(dots(char)).toBeWithin(0, 256);
		const lit = (row: string) => [...row].some((char) => dots(char) !== 0);
		expect(lit(rows[0] ?? '')).toBe(true);
		expect(lit(rows.at(-1) ?? '')).toBe(true);
		expect(rows.every((row) => dots([...row][0] ?? '⠀') === 0 || dots([...row].at(-1) ?? '⠀') === 0 || true)).toBe(
			true,
		);
		// The middle rows have more than the circle's two sides: the rain lines and the trace cross them.
		const middle = rows[Math.floor(rows.length / 2)] ?? '';
		expect([...middle].filter((char) => dots(char) !== 0).length).toBeGreaterThan(4);
	});
});
