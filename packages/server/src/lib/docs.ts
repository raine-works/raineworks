/**
 * A project's documentation, from its repository on GitHub, for `GET /api/docs/<project>`: the Markdown files of the
 * project's docs folder (`DOCS_SOURCES`, `@raineworks/tools/docs`), fetched as raw content, rendered
 * (`lib/docs-render`) and kept, so the site follows the repository without a release.
 *
 * - **Only the docs tree is fetched.** A page's name must match `DOCS_PAGE_PATTERN` (lowercase letters, digits and
 *   hyphens, at most one `/`) and the project must be one of `DOCS_SOURCES`; nothing of a request reaches the URL
 *   otherwise, and redirects are refused.
 * - **Cached** for {@link DOCS_TTL_MS}, requests meanwhile sharing one fetch. A page that isn't there (a 404) is
 *   remembered for {@link MISSING_TTL_MS}, so a new page shows within a minute, and so is a failure with nothing to
 *   fall back on ({@link RETRY_MS}); when GitHub doesn't answer, the last copy is served. The cache holds at most
 *   {@link MAX_ENTRIES} pages (the oldest goes first), so requests for pages that don't exist can't fill it.
 *
 * @module lib/docs
 */

import {
	docsFile,
	docsNav,
	type DocsNavItem,
	renderDocsPage,
	type RenderedDocsPage,
} from '@raineworks/server/lib/docs-render';
import { DOCS_OWNER, DOCS_SOURCES, type DocsProject, isDocsPage } from '@raineworks/tools/docs';
import { tryCatch } from '@raineworks/tools/prototypes';

/** How long a page is kept before GitHub is asked again. */
export const DOCS_TTL_MS = 5 * 60_000;
/** How long a page GitHub doesn't have is remembered. */
export const MISSING_TTL_MS = 60_000;
/** How long, with no copy at all, before a failed request is tried again. */
export const RETRY_MS = 60_000;
/** The most pages kept. */
export const MAX_ENTRIES = 256;
/** The largest page taken: docs are text, a megabyte is far past any. */
export const MAX_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 5_000;

/** A page's Markdown, and when GitHub was asked. */
export interface DocsSource {
	markdown: string;
	fetchedAt: string;
}

/** What asking for a page came to: it, GitHub saying it isn't there, or no answer and no copy from before. */
export type DocsResult = { kind: 'found'; source: DocsSource } | { kind: 'missing' } | { kind: 'unavailable' };

interface Entry {
	result: DocsResult;
	until: number;
}

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<DocsResult>>();

/** Forgets what GitHub said: for tests. */
export function resetDocs(): void {
	cache.clear();
	inFlight.clear();
}

function remember(key: string, result: DocsResult, ttl: number): void {
	cache.delete(key);
	cache.set(key, { result, until: Date.now() + ttl });
	// Oldest first: a Map keeps insertion order.
	while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

/** The raw file's address, or `null` for a page name the docs tree doesn't have. */
export function docsUrl(slug: DocsProject, page?: string): string | null {
	if (page !== undefined && !isDocsPage(page)) return null;
	const { repo, branch } = DOCS_SOURCES[slug];
	return `https://raw.githubusercontent.com/${DOCS_OWNER}/${repo}/${branch}/${docsFile(slug, page)}`;
}

async function fetchDocs(key: string, url: string, fetchImpl: typeof fetch): Promise<DocsResult> {
	const { data, error } = await tryCatch(async () => {
		const response = await fetchImpl(url, {
			headers: { 'User-Agent': 'raineworks.com' },
			redirect: 'error',
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
		const markdown = await response.text();
		if (markdown.length > MAX_BYTES) throw new Error('The page is too large');
		return markdown;
	});
	if (error) {
		console.warn(`The docs page ${key} is unavailable: ${error.message}`);
		const stale = cache.get(key)?.result;
		const result: DocsResult = stale?.kind === 'found' ? stale : { kind: 'unavailable' };
		remember(key, result, result.kind === 'found' ? DOCS_TTL_MS : RETRY_MS);
		return result;
	}
	if (data === null) {
		remember(key, { kind: 'missing' }, MISSING_TTL_MS);
		return { kind: 'missing' };
	}
	const result: DocsResult = { kind: 'found', source: { markdown: data, fetchedAt: new Date().toISOString() } };
	remember(key, result, DOCS_TTL_MS);
	return result;
}

/** A page's Markdown (`page` undefined: the index), from GitHub at most once per {@link DOCS_TTL_MS}. */
export function docsSource(slug: DocsProject, page?: string, fetchImpl: typeof fetch = fetch): Promise<DocsResult> {
	const url = docsUrl(slug, page);
	if (!url) return Promise.resolve({ kind: 'missing' });
	const key = `${slug}/${page ?? ''}`;
	const cached = cache.get(key);
	if (cached && Date.now() < cached.until) return Promise.resolve(cached.result);
	let pending = inFlight.get(key);
	if (!pending) {
		pending = fetchDocs(key, url, fetchImpl).finally(() => inFlight.delete(key));
		inFlight.set(key, pending);
	}
	return pending;
}

/** A page ready to show, with the project's navigation. */
export interface DocsPage extends RenderedDocsPage {
	nav: DocsNavItem[];
	/** The page's file on GitHub. */
	file: string;
	fetchedAt: string;
}

/** Rendering is done once per copy of a page: the cache hands back the same object until GitHub is asked again. */
const rendered = new WeakMap<DocsSource, RenderedDocsPage>();
const navs = new WeakMap<DocsSource, DocsNavItem[]>();

/** One of a project's pages rendered, or why it can't be: missing, or unavailable. */
export async function docsPage(
	slug: DocsProject,
	page?: string,
	fetchImpl: typeof fetch = fetch,
): Promise<{ kind: 'found'; page: DocsPage } | { kind: 'missing' } | { kind: 'unavailable' }> {
	const result = await docsSource(slug, page, fetchImpl);
	if (result.kind !== 'found') return result;
	const { source } = result;
	let body = rendered.get(source);
	if (!body) {
		body = renderDocsPage(slug, page, source.markdown);
		rendered.set(source, body);
	}
	// The navigation is the index's; without it (not fetched yet, or down) the page still shows.
	const index = page === undefined ? result : await docsSource(slug, undefined, fetchImpl);
	let nav: DocsNavItem[] = [];
	if (index.kind === 'found') {
		nav = navs.get(index.source) ?? docsNav(slug, index.source.markdown);
		navs.set(index.source, nav);
	}
	return { kind: 'found', page: { ...body, nav, file: docsFile(slug, page), fetchedAt: source.fetchedAt } };
}
