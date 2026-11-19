import { describe, expect, test } from 'bun:test';

import { CONTACT_LIMITS, contactErrors, contactSchema } from '@raineworks/tools/contact';

describe('the contact form’s rules', () => {
	test('a submission is trimmed', () => {
		expect(contactSchema.parse({ name: ' Ada ', email: ' ada@example.com ', message: ' Hi ' })).toEqual({
			name: 'Ada',
			email: 'ada@example.com',
			message: 'Hi',
		});
	});

	test('each field says what’s wrong with it, one problem each', () => {
		expect(contactErrors({ name: ' ', email: '', message: '' })).toEqual({
			name: 'Enter your name.',
			email: 'Enter your email address, so I can reply.',
			message: 'Write a message.',
		});
		expect(contactErrors({ name: 'Ada', email: 'not-an-email', message: 'Hi' })).toEqual({
			email: 'That doesn’t look like an email address.',
		});
		expect(
			contactErrors({ name: 'Ada', email: 'ada@example.com', message: 'x'.repeat(CONTACT_LIMITS.message + 1) }),
		).toEqual({
			message: 'Keep it to 5,000 characters.',
		});
		expect(contactErrors({ name: 'Ada', email: 'ada@example.com', message: 'Hi' })).toEqual({});
	});
});
