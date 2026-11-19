import { describe, expect, test } from 'bun:test';

import { QueryClient } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import '@raineworks/tools/prototypes';

// The API answers 503 here: what "the server can't say" looks like. Set before the client binds `fetch`.
globalThis.fetch = (async () =>
	Response.json(
		{ error: { code: 'articles_unavailable', message: 'Not now.' } },
		{ status: 503 },
	)) as unknown as typeof fetch;
const { ensureArticlesOn } = await import('@raineworks/web-marketing/components/articles');

/** A query client that already knows whether they're on, as `GET /api/articles` said. */
function knowing(on: boolean) {
	const client = new QueryClient();
	client.setQueryData(['articles', 'on'], on);
	return client;
}

describe('the articles page, in the browser', () => {
	test('is the 404 when they’re off, as the server sent it, so it hydrates as one', async () => {
		const { error } = await ensureArticlesOn(knowing(false)).tryCatch();
		expect(isNotFound(error)).toBe(true);
	});

	test('is the page when they’re on', async () => {
		expect(await ensureArticlesOn(knowing(true))).toBeUndefined();
	});

	test('is the page when the server can’t say, which then says so', async () => {
		expect(await ensureArticlesOn(new QueryClient())).toBeUndefined();
	});
});
