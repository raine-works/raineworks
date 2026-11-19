import { describe, expect, test } from 'bun:test';

import type { Project } from '@raineworks/api';
import { PROJECTS_TTL_MS, projectsLoader, RETRY_MS } from '@raineworks/ssh/server/projects';

const list: Project[] = [
	{
		name: 'ha-grok',
		description: 'Grok for Home Assistant.',
		href: 'https://github.com/raine-works/ha-grok',
		stack: ['Python'],
		stars: 12,
		featured: true,
	},
];

/** A `fetch` that answers every request with `respond`'s response, and records the URLs it was asked. */
function fake(respond: () => Response) {
	const asked: string[] = [];
	const fetch = (async (url: RequestInfo | URL) => {
		asked.push(String(url));
		return respond();
	}) as typeof globalThis.fetch;
	return { fetch, asked };
}

describe('the projects for the sessions', () => {
	test('come from the site’s API, one request shared by every session for ten minutes', async () => {
		let now = 1_000_000;
		const { fetch, asked } = fake(() => Response.json({ projects: list, fetchedAt: '2026-11-19T12:00:00.000Z' }));
		const load = projectsLoader({ apiUrl: 'https://raineworks.test', fetch, now: () => now });
		expect(await Promise.all([load(), load()])).toEqual([list, list]);
		expect(asked).toEqual(['https://raineworks.test/api/projects']);
		now += PROJECTS_TTL_MS + 1;
		await load();
		expect(asked).toHaveLength(2);
	});

	test('are the last ones it gave while the API can’t answer', async () => {
		let now = 1_000_000;
		let answer = () => Response.json({ projects: list, fetchedAt: '2026-11-19T12:00:00.000Z' });
		const { fetch } = fake(() => answer());
		const load = projectsLoader({ apiUrl: 'https://raineworks.test', fetch, now: () => now });
		await load();
		answer = () => Response.json({ error: { code: 'projects_unavailable', message: 'Not now.' } }, { status: 503 });
		now += PROJECTS_TTL_MS + 1;
		expect(await load()).toEqual(list);
	});

	test('are none when the API has never answered, and it isn’t asked again for a minute', async () => {
		let now = 1_000_000;
		const { fetch, asked } = fake(() => new Response('down', { status: 502 }));
		const load = projectsLoader({ apiUrl: 'https://raineworks.test', fetch, now: () => now });
		expect(await load()).toBeNull();
		expect(await load()).toBeNull();
		expect(asked).toHaveLength(1);
		now += RETRY_MS + 1;
		await load();
		expect(asked).toHaveLength(2);
	});
});
