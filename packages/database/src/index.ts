/**
 * Database package entry point.
 *
 * Re-exports the generated Prisma client, the {@link DatabaseListener}
 * for real-time LISTEN/NOTIFY subscriptions, and a pre-configured
 * singleton `db` instance ready for use across the application.
 *
 * ## Connection architecture
 *
 * A single `DATABASE_URL` is used everywhere:
 *
 * | Consumer              | Connection type        |
 * |-----------------------|------------------------|
 * | Prisma Client         | `pg.Pool` (pooled)     |
 * | DatabaseListener      | `pg.Client` (dedicated)|
 * | Prisma CLI migrations | Direct (via config)    |
 * | Trigger setup script  | `pg.Client` (one-shot) |
 *
 * ## Pool tuning
 *
 * The pool should be sized so that the total connections across all
 * replicas stays comfortably below PostgreSQL's `max_connections`
 * (default 100):
 *
 *   `replicas × max_per_replica + headroom ≤ max_connections`
 *
 * The defaults below (max 10, idle timeout 30 s, connect timeout 5 s)
 * work well for small-to-medium workloads.
 *
 * @module @rainestack/database
 *
 * @example
 * ```ts
 * import { db, DatabaseListener } from "@rainestack/database";
 *
 * // Query using the singleton client
 * const users = await db.user.findMany();
 *
 * // Subscribe to real-time changes
 * const listener = new DatabaseListener(process.env.DATABASE_URL!);
 * await listener.connect();
 * listener.onTable("User", (event) => console.log(event));
 * ```
 */

import { PrismaClient } from '@database/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Re-export actor-aware and abortable transaction helpers
// Also available via the subpath import: '@rainestack/database/actor'
export { abortable, TransactionAbortedError, withActor } from '@database/actor';
export type { RecordNotFoundInfo, UniqueViolationInfo } from '@database/errors';
// Re-export Prisma error utilities
// Also available via the subpath import: '@rainestack/database/errors'
export { isPrismaError, recordNotFound, uniqueViolation } from '@database/errors';
// Re-export everything consumers might need from the generated client
export * from '@database/generated/prisma/client';
export { PrismaClient } from '@database/generated/prisma/client';
// Re-export the real-time LISTEN/NOTIFY listener and its types
export type { ReconnectOptions, TableChangeEvent, TableOperation } from '@database/listener';
export { DatabaseListener } from '@database/listener';

// ---------------------------------------------------------------------------
// Singleton PrismaClient
// ---------------------------------------------------------------------------
// In development, hot-reloading creates a new module scope on every change.
// Without a singleton, each reload would open a new connection pool and
// eventually exhaust the database's connection limit. Storing the client on
// `globalThis` ensures only one instance exists across reloads.
//
// In production this is a no-op — the module is loaded once and the single
// instance is reused for the lifetime of the process.
// ---------------------------------------------------------------------------

declare global {
	var prisma: PrismaClient | undefined;
}

/** Creates a new PrismaClient backed by `@prisma/adapter-pg`. */
function createPrismaClient(): PrismaClient {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error('DATABASE_URL environment variable is not set');
	}

	const adapter = new PrismaPg({
		connectionString,
		// Force every session to UTC so that `now()`, `CURRENT_TIMESTAMP`,
		// and `@default(now())` always produce UTC values.
		options: '-c timezone=UTC',
		// Maximum number of connections in the pool.
		max: 10,
		// Close idle connections after 30 seconds.
		idleTimeoutMillis: 30_000,
		// Maximum time to wait for a connection from the pool.
		connectionTimeoutMillis: 5_000
	});

	return new PrismaClient({ adapter });
}

/** Singleton database client — safe to import from anywhere. */
export const db = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prisma = db;
}
