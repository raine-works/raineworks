import { describe, expect, test } from 'bun:test';

import { plural } from '@raineworks/tools/text';

describe('plural', () => {
	test('uses the singular for one and adds an s otherwise', () => {
		expect(plural(1, 'project')).toBe('1 project');
		expect(plural(0, 'project')).toBe('0 projects');
		expect(plural(3, 'project')).toBe('3 projects');
	});

	test('takes an irregular plural', () => {
		expect(plural(1, 'person', 'people')).toBe('1 person');
		expect(plural(2, 'person', 'people')).toBe('2 people');
	});

	test('groups thousands', () => {
		expect(plural(1200, 'account')).toBe('1,200 accounts');
	});
});
