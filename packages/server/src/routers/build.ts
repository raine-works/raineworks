/**
 * `GET /api/build?zone=`: the build a zone is serving, so a page open on it can tell the site was updated under it
 * (`lib/spa.zoneBuild`, `@raineworks/ui/lib/version`). Never cached: the answer changes with every deploy.
 *
 * @module routers/build
 */

import { errorResponse, invalidRequest, jsonResponse } from '@raineworks/server/lib/openapi';
import { zoneBuild } from '@raineworks/server/lib/spa';
import { validate } from '@raineworks/server/lib/validate';
import { ZONE_IDS } from '@raineworks/tools/zones';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';

const buildQuery = z.object({
	zone: z.enum(ZONE_IDS).meta({ description: 'The zone asked about.', examples: ['marketing'] }),
});

/** What `GET /api/build` answers. */
export const buildSchema = z
	.object({
		build: z
			.string()
			.nullable()
			.meta({
				description:
					'The build the zone is serving: its page’s hash, which changes whenever the zone does. A page compares it with its `<meta name="raineworks-build">`. `null` in development.',
				examples: ['tRz67ZhylalZLOz8WkojU9j1EYp'],
			}),
		version: z
			.string()
			.nullable()
			.meta({ description: 'Its release, `YEAR.MONTH.N`; `null` in development.', examples: ['2026.11.1'] }),
		commit: z
			.string()
			.nullable()
			.meta({ description: 'The commit it was built from, short; `null` in development.', examples: ['abc9db2'] }),
	})
	.meta({ description: 'The build a zone is serving.' });

/** Mounted at `/api/build`. */
export const buildRouter = new Hono().get(
	'/',
	describeRoute({
		operationId: 'getBuild',
		summary: 'The build a zone is serving',
		description:
			'What a page asks to notice that the site was updated under it: once `build` differs from the one it loaded with, it offers to reload. Sent with `Cache-Control: no-store`.',
		responses: {
			200: jsonResponse('The zone’s build.', buildSchema),
			400: invalidRequest,
			500: errorResponse('Something went wrong on the server.', 'internal_error'),
		},
	}),
	validate('query', buildQuery),
	async (c) => {
		c.header('Cache-Control', 'no-store');
		return c.json(await zoneBuild(c.req.valid('query').zone), 200);
	},
);
