/**
 * Graceful shutdown handler.
 *
 * Registers signal handlers for `SIGINT` and `SIGTERM` that orchestrate
 * a clean teardown of the HTTP server, database connections, and the
 * LISTEN/NOTIFY listener.
 *
 * Shutdown sequence:
 * 1. Stop accepting new connections (server.stop).
 * 2. Disconnect the DatabaseListener (UNLISTEN + close).
 * 3. Disconnect the Prisma client (drain pool + close).
 * 4. Exit the process.
 *
 * A forced-exit timer ensures the process terminates even if a
 * connection hangs during teardown.
 *
 * @module lib/shutdown
 */

import type { DatabaseListener, PrismaClient } from '@rainestack/database';
import { log } from '@server/lib/logger';

const shutdownLog = log.child({ module: 'shutdown' });

/** Maximum time (ms) to wait for graceful shutdown before forcing exit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

interface ShutdownDeps {
	server: { stop(closeActiveConnections?: boolean): void };
	db: PrismaClient;
	listener: DatabaseListener;
}

/**
 * Registers `SIGINT` and `SIGTERM` handlers that perform a graceful
 * shutdown of all subsystems.
 *
 * Call this once after the HTTP server is created.
 */
export function registerShutdown({ server, db, listener }: ShutdownDeps): void {
	let shuttingDown = false;

	const shutdown = async (signal: string) => {
		if (shuttingDown) return;
		shuttingDown = true;

		shutdownLog.info({ signal }, 'shutdown initiated');

		// Safety net — force exit if graceful teardown hangs.
		const forceTimer = setTimeout(() => {
			shutdownLog.error('shutdown timed out — forcing exit');
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);

		// Unref so this timer alone doesn't keep the event loop alive.
		forceTimer.unref();

		try {
			// 1. Stop accepting new HTTP connections.
			shutdownLog.info('stopping HTTP server');
			server.stop(true);

			// 2. Disconnect the LISTEN/NOTIFY listener.
			shutdownLog.info('disconnecting database listener');
			await listener.disconnect();

			// 3. Disconnect Prisma (drains the pg.Pool).
			shutdownLog.info('disconnecting Prisma client');
			await db.$disconnect();

			shutdownLog.info('shutdown complete');
			process.exit(0);
		} catch (err) {
			shutdownLog.error({ err }, 'error during shutdown');
			process.exit(1);
		}
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
}
