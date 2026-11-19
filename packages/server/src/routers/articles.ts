/**
 * `GET /api/articles`: Raine's articles on X (`lib/x`), newest first, for the `/articles` page. Off without
 * `X_BEARER_TOKEN`: `{ enabled: false }` then, which is how the site knows to show nothing of them (an answer, not a
 * 404, so every page that asks doesn't log a failed request). Cached publicly as long as the server keeps the list.
 *
 * @module routers/articles
 */

import { errorResponse, jsonResponse } from '@raineworks/server/lib/openapi';
import { articles, ARTICLES_TTL_MS, articleSchema, articlesEnabled } from '@raineworks/server/lib/x';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';

/** What `GET /api/articles` answers: the articles, or that they're off. */
export const articlesSchema = z
	.discriminatedUnion('enabled', [
		z.object({
			enabled: z.literal(true).meta({ description: 'The articles are on.' }),
			articles: z.array(articleSchema).meta({ description: 'Every article, newest first.' }),
			fetchedAt: z.iso.datetime().meta({ description: 'When X was asked.', examples: ['2026-11-18T23:00:00.000Z'] }),
		}),
		z.object({
			enabled: z.literal(false).meta({ description: 'The articles are off: the server has no X API token.' }),
		}),
	])
	.meta({ description: 'The articles @raineworks has written on X, or that they’re off.' });

/** Mounted at `/api/articles`. */
export const articlesRouter = new Hono().get(
	'/',
	describeRoute({
		operationId: 'getArticles',
		summary: 'Raine’s articles on X',
		description:
			'The posts by @raineworks on X that are Articles, newest first, each linking to it on x.com. X is asked for new ones at most every hour. Without an X API token the articles are off: `{ "enabled": false }`, and the site shows nothing of them. When X doesn’t answer, the last list it gave; with none yet, a 503.',
		responses: {
			200: jsonResponse('The articles, or that they’re off.', articlesSchema),
			503: errorResponse('X couldn’t be reached, and there’s no list from before.', 'articles_unavailable'),
			500: errorResponse('Something went wrong on the server.', 'internal_error'),
		},
	}),
	async (c) => {
		c.header('Cache-Control', `public, max-age=${ARTICLES_TTL_MS / 1000}`);
		if (!articlesEnabled()) return c.json({ enabled: false as const }, 200);
		const list = await articles();
		if (!list) {
			c.header('Cache-Control', 'no-store');
			return c.json({ error: { code: 'articles_unavailable', message: 'Articles aren’t available right now.' } }, 503);
		}
		return c.json({ enabled: true as const, ...list }, 200);
	},
);
