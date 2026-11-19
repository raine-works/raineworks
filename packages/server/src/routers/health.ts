/**
 * Probes, outside `/api`.
 *
 * - `GET /healthz` — liveness: the process is serving.
 * - `GET /readyz`  — readiness: 503 while draining (`lib/shutdown`).
 *
 * @module routers/health
 */

import { isShuttingDown } from '@raineworks/server/lib/shutdown';
import { Hono } from 'hono';

/** Mounted at the root, ahead of every middleware: `/healthz` and `/readyz`. */
export const healthRouter = new Hono()
	.get('/healthz', (c) => c.text('ok'))
	.get('/readyz', (c) => (isShuttingDown() ? c.json({ status: 'draining' }, 503) : c.json({ status: 'ok' })));
