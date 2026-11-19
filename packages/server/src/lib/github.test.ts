import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import { repoStars, resetRepoStars, RETRY_MS, STARS_TTL_MS } from '@raineworks/server/lib/github';

/** A GitHub that answers with `respond`, counting the requests. */
function github(respond: () => Response) {
	const calls: string[] = [];
	const fetchImpl = (async (input: string | URL | Request) => {
		calls.push(String(input));
		return respond();
	}) as unknown as typeof fetch;
	return { calls, fetch: fetchImpl };
}

const repos = (stars: number) =>
	Response.json([
		{ name: 'ha-grok', stargazers_count: stars, private: false },
		{ name: '.dotfiles', stargazers_count: 2 },
	]);

afterEach(() => {
	resetRepoStars();
	setSystemTime();
});

describe('the repositories’ stars', () => {
	test('come from one request for every repository, kept ten minutes', async () => {
		const { calls, fetch } = github(() => repos(12));
		setSystemTime(new Date('2026-11-18T12:00:00Z'));
		const [first, second] = await Promise.all([repoStars(fetch), repoStars(fetch)]);
		expect(first?.stars).toEqual({ 'ha-grok': 12, '.dotfiles': 2 });
		expect(second).toBe(first);
		expect(calls).toEqual(['https://api.github.com/users/raine-works/repos?per_page=100&type=owner']);
		await repoStars(fetch);
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-18T12:00:00Z') + STARS_TTL_MS + 1));
		await repoStars(fetch);
		expect(calls).toHaveLength(2);
	});

	test('are the last ones GitHub gave while it doesn’t answer', async () => {
		let answer = () => repos(12);
		const { fetch } = github(() => answer());
		setSystemTime(new Date('2026-11-18T12:00:00Z'));
		await repoStars(fetch);
		answer = () => new Response('rate limited', { status: 403 });
		setSystemTime(new Date(Date.parse('2026-11-18T12:00:00Z') + STARS_TTL_MS + 1));
		expect((await repoStars(fetch))?.stars['ha-grok']).toBe(12);
	});

	test('are none when GitHub has never answered, and it isn’t asked again for a minute', async () => {
		const { calls, fetch } = github(() => Response.json({ message: 'not a list' }));
		setSystemTime(new Date('2026-11-18T12:00:00Z'));
		expect(await repoStars(fetch)).toBeNull();
		expect(await repoStars(fetch)).toBeNull();
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-18T12:00:00Z') + RETRY_MS + 1));
		await repoStars(fetch);
		expect(calls).toHaveLength(2);
	});
});
