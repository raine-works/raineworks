/**
 * `GET /api/projects/stars`: how many stars each of Raine's repositories has on GitHub (`lib/github`), for the project
 * cards. Cached publicly as long as the server keeps the counts.
 *
 * @module routers/projects
 */

import { repoStars, STARS_TTL_MS } from '@raineworks/server/lib/github';
import { errorResponse, jsonResponse } from '@raineworks/server/lib/openapi';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';

/** What `GET /api/projects/stars` answers. */
export const starsSchema = z
	.object({
		stars: z.record(z.string(), z.number().int().min(0)).meta({
			description: 'Each repository’s stars, by its name on GitHub.',
			examples: [{ 'ha-grok': 12, '.dotfiles': 3 }],
		}),
		fetchedAt: z.iso.datetime().meta({
			description: 'When GitHub was asked.',
			examples: ['2026-11-18T23:00:00.000Z'],
		}),
	})
	.meta({ description: 'Star counts of the repositories under raine-works on GitHub.' });

/** Mounted at `/api/projects`. */
export const projectsRouter = new Hono().get(
	'/stars',
	describeRoute({
		operationId: 'getProjectStars',
		summary: 'Star counts of Raine’s repositories',
		description:
			'Each public repository under `raine-works` and its stars on GitHub, asked at most every ten minutes. When GitHub doesn’t answer, the last counts it gave; with none yet, a 503.',
		responses: {
			200: jsonResponse('The star counts.', starsSchema),
			503: errorResponse('GitHub couldn’t be reached, and there are no counts from before.', 'stars_unavailable'),
			500: errorResponse('Something went wrong on the server.', 'internal_error'),
		},
	}),
	async (c) => {
		const stars = await repoStars();
		if (!stars)
			return c.json({ error: { code: 'stars_unavailable', message: 'Star counts aren’t available right now.' } }, 503);
		c.header('Cache-Control', `public, max-age=${STARS_TTL_MS / 1000}`);
		return c.json(stars, 200);
	},
);
