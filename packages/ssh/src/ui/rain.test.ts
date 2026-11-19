import { describe, expect, test } from 'bun:test';

import { filterCommands } from '@raineworks/ssh/ui/palette';
import { makeDrops, rainField } from '@raineworks/ssh/ui/rain';

describe('the rain', () => {
	test('is the same for the same size and seed, and falls down and to the left, like the logo’s lines', () => {
		const drops = makeDrops(40, 10, 0.1, 3);
		expect(makeDrops(40, 10, 0.1, 3)).toEqual(drops);
		const [drop] = drops;
		const head = (field: number[][]) => {
			for (let y = 0; y < field.length; y++) {
				const x = field[y]?.indexOf(4) ?? -1;
				if (x !== -1) return { x, y };
			}
			return null;
		};
		const one = [{ ...drop!, offset: 2, column: 20, speed: 1 }];
		expect(head(rainField(one, 40, 10, 0))).toEqual({ x: 18, y: 2 });
		expect(head(rainField(one, 40, 10, 1))).toEqual({ x: 17, y: 3 });
	});

	test('never draws outside its field', () => {
		const field = rainField(makeDrops(30, 6, 0.3), 30, 6, 17);
		expect(field).toHaveLength(6);
		for (const row of field) expect(row).toHaveLength(30);
	});
});

describe('the palette', () => {
	const commands = ['Go to Projects', 'Go to Contact', 'Write a message', 'Quit'].map((label) => ({
		id: label,
		label,
		hint: label === 'Write a message' ? 'Contact' : '',
		run: () => {},
	}));

	test('keeps every command when nothing is typed, and those with every word typed otherwise', () => {
		expect(filterCommands(commands, '')).toHaveLength(4);
		expect(filterCommands(commands, 'contact').map(({ label }) => label)).toEqual(['Go to Contact', 'Write a message']);
		expect(filterCommands(commands, 'go proj').map(({ label }) => label)).toEqual(['Go to Projects']);
		expect(filterCommands(commands, 'nothing')).toEqual([]);
	});
});
