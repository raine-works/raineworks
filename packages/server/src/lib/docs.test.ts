import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import {
	DOCS_TTL_MS,
	docsPage,
	docsSource,
	docsUrl,
	MAX_ENTRIES,
	MISSING_TTL_MS,
	resetDocs,
	RETRY_MS,
} from '@raineworks/server/lib/docs';
import { DOCS_PAGE_PATTERN } from '@raineworks/tools/docs';

/** A GitHub that answers each request with `respond`, counting them. */
function github(respond: (url: string) => Response) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(input), init });
		return respond(String(input));
	}) as unknown as typeof fetch;
	return { calls, fetch: fetchImpl };
}

const INDEX = '# Docs\n\n| Guide | |\n| - | - |\n| [Installation](installation.md) | x |\n';
const files = (url: string) =>
	url.endsWith('/docs/README.md')
		? new Response(INDEX)
		: url.endsWith('/docs/installation.md')
			? new Response('<!-- generated -->\n# Installation\n\nSee [docs](README.md).\n')
			: new Response('Not Found', { status: 404 });

afterEach(() => {
	resetDocs();
	setSystemTime();
});

describe('a docs page’s name', () => {
	test('is lowercase letters, digits and hyphens, at most one `/` deep', () => {
		for (const page of ['installation', 'reference/modules', 'a-1', '2fa/setup'])
			expect(DOCS_PAGE_PATTERN.test(page)).toBe(true);
		for (const page of [
			'',
			'Installation',
			'a/b/c',
			'/a',
			'a/',
			'../etc/passwd',
			'a/..',
			'a.md',
			'a%2fb',
			'a b',
			'a\n',
			'a_b',
		])
			expect({ page, ok: DOCS_PAGE_PATTERN.test(page) }).toEqual({ page, ok: false });
	});

	test('is the only thing of a request in the address fetched, always from the docs folder', () => {
		expect(docsUrl('ha-dashboards')).toBe(
			'https://raw.githubusercontent.com/raine-works/ha-dashboards/master/docs/README.md',
		);
		expect(docsUrl('ha-dashboards', 'reference/modules')).toBe(
			'https://raw.githubusercontent.com/raine-works/ha-dashboards/master/docs/reference/modules.md',
		);
		expect(docsUrl('ha-dashboards', '../secrets')).toBeNull();
	});

	test('that isn’t valid is never fetched', async () => {
		const { calls, fetch } = github(files);
		expect(await docsSource('ha-dashboards', '../../x', fetch)).toEqual({ kind: 'missing' });
		expect(calls).toEqual([]);
	});
});

describe('the docs', () => {
	test('come from GitHub once per page, kept five minutes, requests meanwhile sharing one', async () => {
		const { calls, fetch } = github(files);
		setSystemTime(new Date('2026-11-21T12:00:00Z'));
		const [first, second] = await Promise.all([
			docsSource('ha-dashboards', 'installation', fetch),
			docsSource('ha-dashboards', 'installation', fetch),
		]);
		expect(second).toBe(first);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.init).toMatchObject({ redirect: 'error' });
		await docsSource('ha-dashboards', 'installation', fetch);
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-21T12:00:00Z') + DOCS_TTL_MS + 1));
		await docsSource('ha-dashboards', 'installation', fetch);
		expect(calls).toHaveLength(2);
	});

	test('say when a page isn’t there, remembering it a minute so a new page shows soon', async () => {
		const { calls, fetch } = github(files);
		setSystemTime(new Date('2026-11-21T12:00:00Z'));
		expect(await docsSource('ha-dashboards', 'nope', fetch)).toEqual({ kind: 'missing' });
		await docsSource('ha-dashboards', 'nope', fetch);
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-21T12:00:00Z') + MISSING_TTL_MS + 1));
		await docsSource('ha-dashboards', 'nope', fetch);
		expect(calls).toHaveLength(2);
	});

	test('serve the last copy when GitHub stops answering, and say so with none', async () => {
		let up = true;
		const { fetch } = github((url) => (up ? files(url) : new Response('down', { status: 502 })));
		setSystemTime(new Date('2026-11-21T12:00:00Z'));
		const before = await docsSource('ha-dashboards', 'installation', fetch);
		up = false;
		setSystemTime(new Date(Date.parse('2026-11-21T12:00:00Z') + DOCS_TTL_MS + 1));
		expect(await docsSource('ha-dashboards', 'installation', fetch)).toEqual(before);
		expect(await docsSource('ha-dashboards', 'cards', fetch)).toEqual({ kind: 'unavailable' });
		const { calls, fetch: again } = github(files);
		await docsSource('ha-dashboards', 'cards', again);
		expect(calls).toHaveLength(0);
		setSystemTime(new Date(Date.now() + RETRY_MS + 1));
		await docsSource('ha-dashboards', 'cards', again);
		expect(calls).toHaveLength(1);
	});

	test('refuse a page far larger than any doc', async () => {
		const { fetch } = github(() => new Response('x'.repeat(1_000_001)));
		expect(await docsSource('ha-dashboards', undefined, fetch)).toEqual({ kind: 'unavailable' });
	});

	test('keep a bounded number of pages, so pages that don’t exist can’t fill the cache', async () => {
		const { calls, fetch } = github(files);
		for (let index = 0; index < MAX_ENTRIES + 5; index++) await docsSource('ha-dashboards', `p-${index}`, fetch);
		await docsSource('ha-dashboards', 'p-0', fetch);
		expect(calls).toHaveLength(MAX_ENTRIES + 6);
		await docsSource('ha-dashboards', `p-${MAX_ENTRIES + 4}`, fetch);
		expect(calls).toHaveLength(MAX_ENTRIES + 6);
	});

	test('are rendered with the navigation the index gives, and the page’s file', async () => {
		const { fetch } = github(files);
		const result = await docsPage('ha-dashboards', 'installation', fetch);
		if (result.kind !== 'found') throw new Error('not found');
		expect(result.page).toMatchObject({
			title: 'Installation',
			file: 'docs/installation.md',
			nav: [{ title: 'Installation', page: 'installation', group: 'Guide' }],
		});
		expect(result.page.html).toContain('<a href="/projects/ha-dashboards/docs">docs</a>');
	});

	test('still show a page when the index isn’t available, without the navigation', async () => {
		const { fetch } = github((url) =>
			url.endsWith('/docs/README.md') ? new Response('x', { status: 500 }) : files(url),
		);
		const result = await docsPage('ha-dashboards', 'installation', fetch);
		expect(result).toMatchObject({ kind: 'found', page: { nav: [] } });
	});
});
