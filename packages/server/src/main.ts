/**
 * Process entrypoint: `bun run src/main.ts`, and the compile target for the standalone binary. Starts the HTTP server
 * and stops it gracefully on SIGINT / SIGTERM.
 *
 * @module main
 */

import { createApp } from '@raineworks/server/app';
import { env } from '@raineworks/server/lib/env';
import { registerGracefulShutdown } from '@raineworks/server/lib/shutdown';
import '@raineworks/tools/prototypes';

const app = createApp();

const server = Bun.serve({
	// Loopback only in development and tests, every interface otherwise (`lib/env`).
	hostname: env.HOST,
	port: env.PORT,
	fetch: app.fetch,
	idleTimeout: 30,
});

registerGracefulShutdown({ server, drainMs: env.SHUTDOWN_DRAIN_MS });
console.log(`raineworks server listening on ${server.url.href}`);
