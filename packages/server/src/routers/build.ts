/**
 * `GET /api/build?zone=`: the build a zone is serving, so a page open on it can tell the site was updated under it
 * (`lib/spa.zoneBuild`, `@raineworks/ui/lib/version`). Never cached: the answer changes with every deploy.
 *
 * @module routers/build
 */

import { zoneBuild } from '@raineworks/server/lib/spa';
import { ZONE_IDS } from '@raineworks/tools/zones';
import { Hono } from 'hono';
import { z } from 'zod';

const querySchema = z.object({ zone: z.enum(ZONE_IDS) });

/** Mounted at `/api/build`. An unknown or missing `zone` is a 400 `invalid_request`. */
export const buildRouter = new Hono().get('/', async (c) => {
	c.header('Cache-Control', 'no-store');
	const query = querySchema.safeParse(c.req.query());
	if (!query.success) return c.json({ error: { code: 'invalid_request', message: 'That zone doesn’t exist.' } }, 400);
	return c.json(await zoneBuild(query.data.zone));
});
