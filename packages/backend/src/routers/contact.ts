import { Hono } from 'hono';

const MAX_BODY_BYTES = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactRequest {
	name: string;
	email: string;
	message: string;
}

function parseContact(body: unknown): ContactRequest | null {
	if (typeof body !== 'object' || body === null) return null;
	const { name, email, message } = body as Record<string, unknown>;
	if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') return null;
	const parsed = { name: name.trim(), email: email.trim(), message: message.trim() };
	if (!parsed.name || parsed.name.length > 200) return null;
	if (!EMAIL_PATTERN.test(parsed.email) || parsed.email.length > 320) return null;
	if (!parsed.message || parsed.message.length > 5000) return null;
	return parsed;
}

/**
 * Accepts contact form submissions. Storage/delivery is intentionally not
 * implemented yet: valid submissions are acknowledged and discarded.
 */
export const contactRouter = new Hono().post('/', async (c) => {
	const text = await c.req.text();
	if (text.length > MAX_BODY_BYTES) return c.json({ error: 'Payload too large' }, 413);

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return c.json({ error: 'Invalid JSON' }, 400);
	}

	const contact = parseContact(body);
	if (!contact) return c.json({ error: 'Invalid contact submission' }, 400);

	// TODO: persist or forward `contact` once a handling strategy is chosen.
	return c.json({ received: true }, 202);
});
