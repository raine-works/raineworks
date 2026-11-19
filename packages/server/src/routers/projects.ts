/**
 * `GET /api/projects`: Raine's projects, the repositories tagged `raineworks` on GitHub (`lib/github`), with their
 * stars, for the project cards and the SSH app. Cached publicly as long as the server keeps the list.
 *
 * @module routers/projects
 */

import { projects, PROJECTS_TTL_MS, projectSchema } from '@raineworks/server/lib/github';
import { errorResponse, jsonResponse } from '@raineworks/server/lib/openapi';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';

/** What `GET /api/projects` answers. */
export const projectsSchema = z
	.object({
		projects: z.array(projectSchema).meta({ description: 'Every project, by name (a leading dot aside).' }),
		fetchedAt: z.iso.datetime().meta({
			description: 'When GitHub was asked.',
			examples: ['2026-11-18T23:00:00.000Z'],
		}),
	})
	.meta({ description: 'The repositories under raine-works on GitHub tagged `raineworks`.' });

/** Mounted at `/api/projects`. */
export const projectsRouter = new Hono().get(
	'/',
	describeRoute({
		operationId: 'getProjects',
		summary: 'Raine’s projects',
		description:
			'Each public repository under `raine-works` with the topic `raineworks` (forks and archived ones aside): its description, what it’s built with, its stars, and whether it’s featured (the topic `raineworks-featured`). GitHub is asked at most every ten minutes. When it doesn’t answer, the last list it gave; with none yet, a 503.',
		responses: {
			200: jsonResponse('The projects.', projectsSchema),
			503: errorResponse('GitHub couldn’t be reached, and there’s no list from before.', 'projects_unavailable'),
			500: errorResponse('Something went wrong on the server.', 'internal_error'),
		},
	}),
	async (c) => {
		const list = await projects();
		if (!list)
			return c.json({ error: { code: 'projects_unavailable', message: 'Projects aren’t available right now.' } }, 503);
		c.header('Cache-Control', `public, max-age=${PROJECTS_TTL_MS / 1000}`);
		return c.json(list, 200);
	},
);
