/**
 * Hono application.
 *
 * ```
 * /healthz, /readyz            probes
 * /api/articles                Raine's articles on X (lib/x; cached an hour; `enabled: false` without X_BEARER_TOKEN)
 * /api/build                   the build a zone is serving, for its update check (lib/spa)
 * /api/contact                 the contact form (POST; acknowledged, not yet stored or delivered)
 * /api/projects/stars          star counts of Raine's repositories on GitHub (lib/github; cached ten minutes)
 * /api/openapi.json            OpenAPI 3.1 document of every /api route (lib/openapi; cached publicly an hour)
 * /api/*                       anything else under /api: a JSON 404
 * /feed.xml                    the articles as RSS (lib/rss; only with X_BEARER_TOKEN)
 * /*                           the web zones (lib/spa), one per entry in @raineworks/tools/zones; `/` is `marketing`;
 *                              `/articles` is their 404 without X_BEARER_TOKEN
 * ```
 *
 * `AppType` is the type root for the `hc` RPC client in `@raineworks/api`.
 *
 * @module app
 */

import { specFor } from '@raineworks/server/lib/openapi';
import { articlesFeed } from '@raineworks/server/lib/rss';
import { serveSpa } from '@raineworks/server/lib/spa';
import { articles, ARTICLES_TTL_MS, articlesEnabled } from '@raineworks/server/lib/x';
import { articlesRouter } from '@raineworks/server/routers/articles';
import { buildRouter } from '@raineworks/server/routers/build';
import { contactRouter } from '@raineworks/server/routers/contact';
import { healthRouter } from '@raineworks/server/routers/health';
import { projectsRouter } from '@raineworks/server/routers/projects';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';

/** Every `/api` route. Chained so an RPC client can infer request/response types. */
export const api = new Hono()
	.route('/articles', articlesRouter)
	.route('/build', buildRouter)
	.route('/contact', contactRouter)
	.route('/projects', projectsRouter);

/** Browser features no zone uses, denied outright. Turn one on here when a zone needs it. */
const PERMISSIONS_POLICY = {
	accelerometer: false,
	autoplay: false,
	browsingTopics: false,
	camera: false,
	displayCapture: false,
	geolocation: false,
	gyroscope: false,
	hid: false,
	magnetometer: false,
	microphone: false,
	midi: false,
	payment: false,
	serial: false,
	usb: false,
};

/** The `/api`-mounted tree — the `hc<AppType>` type root. */
const typedApp = new Hono().route('/api', api);
/** Every `/api` route with its input and output types. */
export type AppType = typeof typedApp;

/** Builds the whole app: probes, headers, `/api` and the zones. A new instance per call, so tests get their own. */
export function createApp() {
	const app = new Hono();

	app.route('/', healthRouter);

	app.use(
		'*',
		secureHeaders({
			crossOriginResourcePolicy: false,
			crossOriginOpenerPolicy: 'same-origin',
			referrerPolicy: 'strict-origin-when-cross-origin',
			permissionsPolicy: PERMISSIONS_POLICY,
		}),
	);

	// Generated from the routes once per process; the same for everyone, so cached publicly.
	app.get('/api/openapi.json', async (c) => {
		c.header('Cache-Control', 'public, max-age=3600');
		return c.json(await specFor(typedApp as never));
	});
	app.route('/api', api);
	app.all('/api/*', (c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

	// The articles as RSS; without an X API token, nothing here (the zone's 404 for an unknown file).
	app.get('/feed.xml', async (c, next) => {
		if (!articlesEnabled()) return next();
		const list = await articles();
		if (!list) return c.text('The articles aren’t available right now.', 503);
		c.header('Cache-Control', `public, max-age=${ARTICLES_TTL_MS / 1000}`);
		return c.body(articlesFeed(list.articles), 200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
	});

	app.get(
		'*',
		async (c) => (await serveSpa(c.req.raw, articlesEnabled() ? [] : ['/articles'])) ?? c.text('Not Found', 404),
	);

	app.onError(renderError);

	return app;
}

/**
 * `app.onError`: anything a route throws as `{ error: { code, message } }`, like every other refusal. Hono's own (a
 * malformed JSON body is a 400) keep their status; anything else is a 500 whose cause is logged, never told.
 */
export function renderError(error: Error, c: Context): Response {
	if (error instanceof HTTPException && error.status < 500) {
		const code = error.status === 413 ? 'payload_too_large' : 'invalid_request';
		return c.json({ error: { code, message: 'That request couldn’t be read.' } }, error.status);
	}
	console.error('Unhandled error', error);
	return c.json({ error: { code: 'internal_error', message: 'Something went wrong.' } }, 500);
}
