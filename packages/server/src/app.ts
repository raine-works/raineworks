/**
 * Hono application.
 *
 * ```
 * /healthz, /readyz            probes
 * /api/build                   the build a zone is serving, for its update check (lib/spa)
 * /api/contact                 the contact form (POST; acknowledged, not yet stored or delivered)
 * /api/*                       anything else under /api: a JSON 404
 * /*                           the web zones (lib/spa), one per entry in @raineworks/tools/zones; `/` is `marketing`
 * ```
 *
 * `AppType` is the type root for the `hc` RPC client in `@raineworks/api`.
 *
 * @module app
 */

import { serveSpa } from '@raineworks/server/lib/spa';
import { buildRouter } from '@raineworks/server/routers/build';
import { contactRouter } from '@raineworks/server/routers/contact';
import { healthRouter } from '@raineworks/server/routers/health';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/** Every `/api` route. Chained so an RPC client can infer request/response types. */
export const api = new Hono().route('/build', buildRouter).route('/contact', contactRouter);

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

	app.route('/api', api);
	app.all('/api/*', (c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

	app.get('*', async (c) => (await serveSpa(c.req.raw)) ?? c.text('Not Found', 404));

	return app;
}
