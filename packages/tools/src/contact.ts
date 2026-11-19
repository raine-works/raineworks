/**
 * The contact form's rules, shared by the server (`POST /api/contact`, `@raineworks/server/routers/contact`) and the
 * form (`@raineworks/web-marketing/components/contact-form`), so the page and the API never disagree on what's valid:
 * each field trimmed, required and capped, with the sentence a person reads when it isn't.
 *
 * @module contact
 */

import { z } from 'zod';

/** The most each field takes. */
export const CONTACT_LIMITS = { name: 200, email: 320, message: 5000 } as const;

/** A submission. */
export const contactSchema = z.object({
	name: z.string().trim().min(1, 'Enter your name.').max(CONTACT_LIMITS.name, 'That name is too long.'),
	email: z
		.string()
		.trim()
		.min(1, 'Enter your email address, so I can reply.')
		.max(CONTACT_LIMITS.email, 'That email address is too long.')
		.pipe(z.email('That doesn’t look like an email address.')),
	message: z
		.string()
		.trim()
		.min(1, 'Write a message.')
		.max(CONTACT_LIMITS.message, `Keep it to ${CONTACT_LIMITS.message.toLocaleString('en')} characters.`),
});

/** A valid submission. */
export type ContactRequest = z.infer<typeof contactSchema>;

/** One of the form's fields. */
export type ContactField = keyof ContactRequest;

/** What's wrong with each field of `input`, by field (the first problem each has); empty when it's valid. */
export function contactErrors(input: Record<ContactField, string>): Partial<Record<ContactField, string>> {
	const result = contactSchema.safeParse(input);
	if (result.success) return {};
	const errors: Partial<Record<ContactField, string>> = {};
	for (const issue of result.error.issues) {
		const field = issue.path[0] as ContactField;
		errors[field] ??= issue.message;
	}
	return errors;
}
