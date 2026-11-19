/**
 * `POST /api/contact`: the contact form (`web-marketing`'s `/contact`). A submission is validated and acknowledged
 * with a 202; it isn't stored or delivered yet. The body is capped at `MAX_BODY_BYTES` before it's read. The rules
 * are `@raineworks/tools/contact`'s, the ones the form checks before it sends, and the ones the API's document shows.
 *
 * @module routers/contact
 */

import { errorBody, errorResponse, invalidRequest, jsonResponse } from '@raineworks/server/lib/openapi';
import { validate } from '@raineworks/server/lib/validate';
import { contactSchema } from '@raineworks/tools/contact';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

/** Larger than any submission the schema allows (with JSON's escaping), refused before it's parsed. */
const MAX_BODY_BYTES = 10_000;

/** What `POST /api/contact` answers once it's taken a message. */
export const receivedSchema = z
	.object({ received: z.literal(true).meta({ description: 'Always `true`: the message was accepted.' }) })
	.meta({ description: 'The message was accepted.' });

/** Mounted at `/api/contact`. */
export const contactRouter = new Hono().post(
	'/',
	describeRoute({
		operationId: 'sendContactMessage',
		summary: 'Send a message',
		description: `The contact form's message to Raine. Each field is trimmed, required and capped (\`name\` 200 characters, \`email\` 320, \`message\` 5,000); the body is refused over ${MAX_BODY_BYTES.toLocaleString('en')} bytes before it's read. Accepted messages are acknowledged with a 202; they aren't stored or delivered yet.`,
		responses: {
			202: jsonResponse('Accepted.', receivedSchema),
			400: invalidRequest,
			413: errorResponse(`The body is over ${MAX_BODY_BYTES.toLocaleString('en')} bytes.`, 'payload_too_large'),
			500: errorResponse('Something went wrong on the server.', 'internal_error'),
		},
	}),
	bodyLimit({
		maxSize: MAX_BODY_BYTES,
		onError: (c) =>
			c.json(
				{ error: { code: 'payload_too_large', message: 'That message is too long.' } } satisfies z.infer<
					ReturnType<typeof errorBody>
				>,
				413,
			),
	}),
	validate('json', contactSchema),
	// Not stored or delivered yet: once there's somewhere for it to go, it goes through a queue, never from here.
	(c) => c.json({ received: true } as const, 202),
);
