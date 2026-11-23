import '@raineworks/tools/prototypes';

import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import { articles, ARTICLES_TTL_MS, resetArticles, RETRY_MS, toArticles } from '@raineworks/server/lib/x';

/** An X that answers each request with `respond`, recording the URLs and tokens it was asked with. */
function x(respond: (url: URL) => Response) {
	const calls: { url: URL; auth: string | null }[] = [];
	const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
		return respond(url);
	}) as unknown as typeof fetch;
	return { calls, fetch: fetchImpl };
}

const post = (id: string, createdAt: string, article?: Record<string, unknown>) => ({
	id,
	text: `Post ${id}\nmore`,
	created_at: createdAt,
	...(article && { article }),
});

/** The account, then `pages` of its posts, one per timeline request. */
function timeline(...pages: ReturnType<typeof post>[][]) {
	let page = 0;
	return (url: URL) => {
		if (url.pathname.endsWith('/users/by/username/raineworks')) return Response.json({ data: { id: '42' } });
		const posts = pages[page++] ?? [];
		return Response.json(
			posts.isEmpty() ? { meta: { result_count: 0 } } : { data: posts, meta: { newest_id: posts[0]?.id } },
		);
	};
}

afterEach(() => {
	resetArticles();
	setSystemTime();
});

describe('the articles', () => {
	test('are the posts that are Articles, with a title, a summary and a link to the post', () => {
		const list = toArticles([
			post('3', '2026-11-18T12:00:00.000Z', { title: ' On homelabs ', preview_text: 'One small machine.' }),
			post('2', '2026-11-17T12:00:00.000Z'),
			post('1', '2026-11-16T12:00:00+00:00', { plain_text: `${'word '.repeat(80)}end` }),
		]);
		expect(list.map(({ id, title }) => [id, title])).toEqual([
			['3', 'On homelabs'],
			['1', 'Post 1'],
		]);
		expect(list[0]).toMatchObject({
			summary: 'One small machine.',
			url: 'https://x.com/raineworks/status/3',
			publishedAt: '2026-11-18T12:00:00.000Z',
		});
		expect(list[1]?.summary.length).toBeLessThanOrEqual(281);
		expect(list[1]?.summary).toEndWith('word…');
	});

	test('are none, and X never asked, without a token', async () => {
		const { calls, fetch } = x(timeline());
		expect(await articles(fetch, undefined)).toBeNull();
		expect(calls).toHaveLength(0);
	});

	test('look the account up once, then read only posts newer than the newest seen, an hour apart', async () => {
		const { calls, fetch } = x(
			timeline(
				[post('2', '2026-11-18T12:00:00.000Z', { title: 'Second' }), post('1', '2026-11-17T12:00:00.000Z')],
				[post('3', '2026-11-19T12:00:00.000Z', { title: 'Third' })],
			),
		);
		setSystemTime(new Date('2026-11-19T13:00:00Z'));
		const [first, second] = await Promise.all([articles(fetch, 'token'), articles(fetch, 'token')]);
		expect(second).toBe(first);
		expect(first?.articles.map((article) => article.title)).toEqual(['Second']);
		expect(calls.map(({ url }) => url.pathname)).toEqual(['/2/users/by/username/raineworks', '/2/users/42/tweets']);
		expect(calls[0]?.auth).toBe('Bearer token');
		const read = calls[1]?.url.searchParams;
		expect(read?.get('tweet.fields')).toBe('article,created_at');
		expect(read?.get('exclude')).toBe('replies,retweets');
		expect(read?.has('since_id')).toBe(false);

		await articles(fetch, 'token');
		expect(calls).toHaveLength(2);
		setSystemTime(new Date(Date.parse('2026-11-19T13:00:00Z') + ARTICLES_TTL_MS + 1));
		const later = await articles(fetch, 'token');
		expect(calls.map(({ url }) => url.pathname).at(-1)).toBe('/2/users/42/tweets');
		expect(calls.at(-1)?.url.searchParams.get('since_id')).toBe('2');
		expect(later?.articles.map((article) => article.title)).toEqual(['Third', 'Second']);
	});

	test('are the last ones X gave while it doesn’t answer', async () => {
		let down = false;
		const answer = timeline([post('2', '2026-11-18T12:00:00.000Z', { title: 'Second' })]);
		const { fetch } = x((url) => (down ? new Response('rate limited', { status: 429 }) : answer(url)));
		setSystemTime(new Date('2026-11-19T13:00:00Z'));
		await articles(fetch, 'token');
		down = true;
		setSystemTime(new Date(Date.parse('2026-11-19T13:00:00Z') + ARTICLES_TTL_MS + 1));
		expect((await articles(fetch, 'token'))?.articles.map((article) => article.title)).toEqual(['Second']);
	});

	test('are none when X has never answered, and it isn’t asked again for five minutes', async () => {
		const { calls, fetch } = x(() => new Response('unauthorized', { status: 401 }));
		setSystemTime(new Date('2026-11-19T13:00:00Z'));
		expect(await articles(fetch, 'token')).toBeNull();
		expect(await articles(fetch, 'token')).toBeNull();
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-19T13:00:00Z') + RETRY_MS + 1));
		await articles(fetch, 'token');
		expect(calls).toHaveLength(2);
	});
});
