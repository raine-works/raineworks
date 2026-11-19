/**
 * Graceful shutdown: on SIGINT/SIGTERM fail readiness (`/readyz` answers 503) and keep serving for the drain delay, so
 * load balancers see it and stop sending traffic before the port closes; then stop accepting connections, let
 * in-flight requests finish, and exit. A second signal or the timeout forces the exit.
 *
 * @module lib/shutdown
 */

import type { Server } from 'bun';
import '@raineworks/tools/prototypes';

/** How long stopping may take, after the drain, before the exit is forced. */
const TIMEOUT_MS = 15_000;

let shuttingDown = false;

/** Whether a shutdown has begun: `/readyz` fails from then on. */
export const isShuttingDown = (): boolean => shuttingDown;

/** Stops `server` gracefully on SIGINT / SIGTERM, after serving `drainMs` longer with readiness failing. */
export function registerGracefulShutdown({ server, drainMs }: { server: Server<unknown>; drainMs: number }): void {
	const stop = async (signal: string) => {
		if (shuttingDown) {
			console.error(`${signal} again: exiting now`);
			process.exit(1);
		}
		shuttingDown = true;
		console.log(`${signal}: draining for ${drainMs}ms, then stopping`);
		const timer = setTimeout(() => {
			console.error(`Still stopping after ${TIMEOUT_MS}ms: exiting`);
			process.exit(1);
		}, drainMs + TIMEOUT_MS);
		timer.unref();
		await Bun.sleep(drainMs);
		const { error } = await server.stop().tryCatch();
		if (error) console.error('Stopping the server failed', error);
		process.exit(error ? 1 : 0);
	};
	process.on('SIGINT', () => void stop('SIGINT'));
	process.on('SIGTERM', () => void stop('SIGTERM'));
}
