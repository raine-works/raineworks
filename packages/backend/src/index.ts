import { env } from '@backend/lib/env';
import { type MicroFrontend, resolveLocalDist, serveMicroFrontends } from '@backend/lib/mfe';
import { contactRouter } from '@backend/routers/contact';
import { healthRouter } from '@backend/routers/health';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';

/**
 * Frontend packages served by this backend. `route: ''` mounts at the site root.
 * Staged into `mfes/<route>/` (or `mfes/__root__/` for the root entry) by
 * `scripts/build.ts` when compiling the standalone binary.
 */
const frontends: MicroFrontend[] = [{ route: '', distDir: resolveLocalDist('marketing') }];

export const app = new Hono()
	.use(
		'*',
		cors({
			origin: '*',
			allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization'],
		}),
	)
	.use('*', compress())
	.route('/api/health', healthRouter)
	.route('/api/contact', contactRouter)
	.all('*', async (c) => {
		if (c.req.path.startsWith('/api')) {
			return c.json({ error: 'API route not found', path: c.req.path }, 404);
		}
		return serveMicroFrontends(c.req.raw, frontends);
	});

export default {
	port: env.PORT,
	fetch: app.fetch,
};
