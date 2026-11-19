/**
 * Sending the contact form from a session: through the site's API (`POST /api/contact`, `@raineworks/api`), so a
 * message from the terminal goes where one from the website does, checked by the same rules. One a minute per session,
 * so a connection can't hammer it.
 *
 * @module server/messages
 */

import { createApiClient } from '@raineworks/api';
import type { SendMessage } from '@raineworks/ssh/app';
import '@raineworks/tools/prototypes';

/** How long a session waits between messages. */
export const MESSAGE_COOLDOWN_MS = 60_000;

/** A sender for one session, to the API at `apiUrl` (its `fetch` replaceable for tests). */
export function messageSender({
	apiUrl,
	fetch,
	cooldownMs = MESSAGE_COOLDOWN_MS,
	now = Date.now,
}: {
	apiUrl: string;
	fetch?: typeof globalThis.fetch;
	cooldownMs?: number;
	now?: () => number;
}): SendMessage {
	const api = createApiClient({ url: apiUrl, fetch, timeoutMs: 15_000 });
	let lastSent = Number.NEGATIVE_INFINITY;
	return async (input) => {
		const wait = lastSent + cooldownMs - now();
		if (wait > 0) return { ok: false, message: `You just sent one. Try again in ${Math.ceil(wait / 1000)} seconds.` };
		const { data: response, error } = await api.api.contact.$post({ json: input }).tryCatch();
		if (error || !response) return { ok: false, message: 'Couldn’t reach the server. Try again in a moment.' };
		if (response.ok) {
			lastSent = now();
			return { ok: true };
		}
		const { data: body } = await (response.json() as Promise<{ error?: { message?: string } }>).tryCatch();
		return { ok: false, message: body?.error?.message ?? 'That didn’t go through. Try again in a moment.' };
	};
}
