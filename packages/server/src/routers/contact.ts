/**
 * `POST /api/contact`: the contact form (`web-marketing`'s `/contact`). A submission is validated and acknowledged
 * with a 202; it isn't stored or delivered yet. The body is capped at `MAX_BODY_BYTES` before it's read.
 *
 * @module routers/contact
 */

import { tryCatch } from '@raineworks/tools/prototypes';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

/** Larger than any submission the schema allows (with JSON's escaping), refused before it's parsed. */
const MAX_BODY_BYTES = 10_000;

/** A submission: trimmed, each field required and capped. */
export const contactSchema = z.object({
	name: z.string().trim().min(1, 'Enter your name.').max(200, 'That name is too long.'),
	email: z.email('Enter a valid email address.').trim().max(320, 'That email address is too long.'),
	message: z
		.string()
		.trim()
		.min(1, 'Enter a message.')
		.max(5000, 'That message is too long (5,000 characters at most).'),
});

/** A valid submission. */
export type ContactRequest = z.infer<typeof contactSchema>;

const invalid = (message: string) => ({ error: { code: 'invalid_request', message } }) as const;

/** Mounted at `/api/contact`. */
export const contactRouter = new Hono().post(
	'/',
	bodyLimit({
		maxSize: MAX_BODY_BYTES,
		onError: (c) => c.json({ error: { code: 'payload_too_large', message: 'That message is too long.' } }, 413),
	}),
	async (c) => {
		const { data: body, error } = await tryCatch(() => c.req.json<unknown>());
		if (error) return c.json(invalid('That request couldn’t be read.'), 400);
		const parsed = contactSchema.safeParse(body);
		if (!parsed.success)
			return c.json(invalid(parsed.error.issues[0]?.message ?? 'Check the form and try again.'), 400);
		// Not stored or delivered yet: once there's somewhere for it to go, it goes through a queue, never from here.
		return c.json({ received: true } as const, 202);
	},
);
