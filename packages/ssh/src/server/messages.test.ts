import { describe, expect, test } from 'bun:test';

import { messageSender } from '@raineworks/ssh/server/messages';

const input = { name: 'Ada', email: 'ada@example.com', message: 'Hi' };

/** A `fetch` that answers every request with `respond`'s response, and records what it was asked. */
function fake(respond: () => Response | Promise<Response>) {
	const asked: { url: string; body: unknown }[] = [];
	const fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
		asked.push({ url: String(url), body: JSON.parse(String(init?.body ?? 'null')) });
		return respond();
	}) as typeof globalThis.fetch;
	return { fetch, asked };
}

describe('sending a message from a session', () => {
	test('posts it to the site’s API', async () => {
		const { fetch, asked } = fake(() => Response.json({ received: true }, { status: 202 }));
		const send = messageSender({ apiUrl: 'https://raineworks.test', fetch });
		expect(await send(input)).toEqual({ ok: true });
		expect(asked).toEqual([{ url: 'https://raineworks.test/api/contact', body: input }]);
	});

	test('one a minute per session: a second too soon is refused without asking the API', async () => {
		let now = 1_000_000;
		const { fetch, asked } = fake(() => Response.json({ received: true }, { status: 202 }));
		const send = messageSender({ apiUrl: 'https://raineworks.test', fetch, now: () => now });
		await send(input);
		now += 18_000;
		expect(await send(input)).toEqual({ ok: false, message: 'You just sent one. Try again in 42 seconds.' });
		expect(asked).toHaveLength(1);
		now += 42_000;
		expect(await send(input)).toEqual({ ok: true });
	});

	test('says what the API refused, and that it couldn’t reach it', async () => {
		const refused = fake(() =>
			Response.json(
				{ error: { code: 'invalid_request', message: 'That doesn’t look like an email address.' } },
				{ status: 400 },
			),
		);
		expect(await messageSender({ apiUrl: 'https://raineworks.test', fetch: refused.fetch })(input)).toEqual({
			ok: false,
			message: 'That doesn’t look like an email address.',
		});
		const down = fake(() => Promise.reject(new TypeError('fetch failed')));
		expect(await messageSender({ apiUrl: 'https://raineworks.test', fetch: down.fetch })(input)).toEqual({
			ok: false,
			message: 'Couldn’t reach the server. Try again in a moment.',
		});
	});
});
