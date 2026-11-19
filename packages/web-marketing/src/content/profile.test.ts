import { describe, expect, test } from 'bun:test';

import { isWritten } from '@raineworks/web-marketing/content/profile';

describe('isWritten', () => {
	test('keeps copy still to be written off the page', () => {
		expect(isWritten('TODO(raine): a few sentences')).toBe(false);
		expect(isWritten('Self-hosting on my own hardware.')).toBe(true);
	});
});
