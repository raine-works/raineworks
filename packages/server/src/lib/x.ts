/**
 * Raine's articles on X (`@raineworks`), for `GET /api/articles` and `/feed.xml`: the posts on X that are Articles,
 * newest first, each linking to it on x.com. Read through the X API with `X_BEARER_TOKEN`; without one, they're off
 * ({@link articlesEnabled}) and nothing asks X.
 *
 * X bills each post read, so it's asked as little as it can be: the account's id once, then its latest
 * {@link FIRST_READ} posts (replies and reposts left out), then every {@link ARTICLES_TTL_MS} only the posts newer than
 * the newest it has seen (`since_id`). Requests that arrive meanwhile share one. When X doesn't answer, the last list
 * it gave is served; with none, `null`, and it isn't asked again for {@link RETRY_MS}. An Article deleted on X stays
 * listed until the server restarts.
 *
 * @module lib/x
 */

import { env } from '@raineworks/server/lib/env';
import { tryCatch } from '@raineworks/tools/prototypes';
import { z } from 'zod';

/** Whose articles. */
export const X_HANDLE = 'raineworks';
/** How long the list is kept before X is asked for newer posts. */
export const ARTICLES_TTL_MS = 60 * 60_000;
/** How long, with no list at all, before a failed request is tried again. */
export const RETRY_MS = 5 * 60_000;
/** How many of the latest posts are read the first time (X's most for one request). */
export const FIRST_READ = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const API = 'https://api.x.com/2';

/** Whether the articles are on: only with an X API token. */
export const articlesEnabled = (): boolean => env.X_BEARER_TOKEN !== undefined;

const userSchema = z.object({ data: z.object({ id: z.string() }) });

const postsSchema = z.object({
	data: z
		.array(
			z.object({
				id: z.string(),
				text: z.string().catch(''),
				created_at: z.iso.datetime({ offset: true }),
				article: z
					.looseObject({
						title: z.string().optional().catch(undefined),
						preview_text: z.string().optional().catch(undefined),
						plain_text: z.string().optional().catch(undefined),
					})
					.optional()
					.catch(undefined),
			}),
		)
		.optional(),
	meta: z.object({ newest_id: z.string().optional() }).optional(),
});

/** How long a summary is at most, cut at a word, when X gives the article's text rather than a preview. */
const SUMMARY_LENGTH = 280;

/** An article, as the page and the feed show it. */
export const articleSchema = z.object({
	id: z.string().meta({ description: 'The post’s id on X.', examples: ['1858123456789012345'] }),
	title: z.string().meta({ description: 'The article’s title.', examples: ['Running Home Assistant on a budget'] }),
	summary: z.string().meta({
		description: 'Its first lines, empty when X gives none.',
		examples: ['What I learned moving my homelab onto one small machine.'],
	}),
	url: z.url().meta({
		description: 'The article on x.com.',
		examples: ['https://x.com/raineworks/status/1858123456789012345'],
	}),
	publishedAt: z.iso.datetime().meta({ description: 'When it was posted.', examples: ['2026-11-18T23:00:00.000Z'] }),
});

export type Article = z.infer<typeof articleSchema>;

/** The articles, newest first, and when X was last asked. */
export interface Articles {
	articles: Article[];
	fetchedAt: string;
}

const firstLine = (text: string) =>
	text
		.split('\n')
		.find((line) => line.trim())
		?.trim() ?? '';

/** `text` cut to {@link SUMMARY_LENGTH} at a word, with an ellipsis when it was cut. */
function summarize(text: string): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	if (flat.length <= SUMMARY_LENGTH) return flat;
	const cut = flat.slice(0, SUMMARY_LENGTH);
	return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : SUMMARY_LENGTH).trimEnd()}…`;
}

/** The posts that are Articles, as articles. */
export function toArticles(posts: z.infer<typeof postsSchema>['data'] = []): Article[] {
	return posts
		.filter((post) => post.article)
		.map((post) => ({
			id: post.id,
			title: post.article?.title?.trim() || firstLine(post.text) || 'An article on X',
			summary: summarize(post.article?.preview_text || post.article?.plain_text || ''),
			url: `https://x.com/${X_HANDLE}/status/${post.id}`,
			publishedAt: new Date(post.created_at).toISOString(),
		}));
}

let userId: string | null = null;
let newestId: string | null = null;
let cached: { value: Articles | null; until: number } | null = null;
let inFlight: Promise<Articles | null> | null = null;

/** Forgets what X said: for tests. */
export function resetArticles(): void {
	userId = null;
	newestId = null;
	cached = null;
	inFlight = null;
}

async function ask<T>(fetchImpl: typeof fetch, token: string, path: string, schema: z.ZodType<T>): Promise<T> {
	const response = await fetchImpl(`${API}${path}`, {
		headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'raineworks.com' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`X answered ${response.status}`);
	return schema.parse(await response.json());
}

async function fetchArticles(fetchImpl: typeof fetch, token: string): Promise<Articles | null> {
	const { data: fresh, error } = await tryCatch(async () => {
		userId ??= (await ask(fetchImpl, token, `/users/by/username/${X_HANDLE}`, userSchema)).data.id;
		const query = new URLSearchParams({
			max_results: String(FIRST_READ),
			exclude: 'replies,retweets',
			'tweet.fields': 'article,created_at',
			...(newestId && { since_id: newestId }),
		});
		return ask(fetchImpl, token, `/users/${userId}/tweets?${query}`, postsSchema);
	});
	if (error) {
		console.warn(`X’s articles are unavailable: ${error.message}`);
		const stale = cached?.value ?? null;
		cached = { value: stale, until: Date.now() + (stale ? ARTICLES_TTL_MS : RETRY_MS) };
		return stale;
	}
	newestId = fresh.meta?.newest_id ?? newestId;
	const known = cached?.value?.articles ?? [];
	const added = toArticles(fresh.data).filter((article) => !known.some((each) => each.id === article.id));
	const articles = [...added, ...known].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
	const value = { articles, fetchedAt: new Date().toISOString() };
	cached = { value, until: Date.now() + ARTICLES_TTL_MS };
	return value;
}

/**
 * The articles, from X at most once per {@link ARTICLES_TTL_MS}; requests that arrive meanwhile share one fetch.
 * `null` when X has never answered. Only called when {@link articlesEnabled}.
 */
export function articles(
	fetchImpl: typeof fetch = fetch,
	token: string | undefined = env.X_BEARER_TOKEN,
): Promise<Articles | null> {
	if (!token) return Promise.resolve(null);
	if (cached && Date.now() < cached.until) return Promise.resolve(cached.value);
	inFlight ??= fetchArticles(fetchImpl, token).finally(() => {
		inFlight = null;
	});
	return inFlight;
}
