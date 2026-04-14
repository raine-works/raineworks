/**
 * Applies database triggers, audit infrastructure, and cron jobs.
 *
 * Reads `scripts/triggers.sql` and executes it against the database
 * using a direct pg connection. This must run AFTER Prisma migrations
 * have created the tables, because the trigger statements reference
 * table names.
 *
 * PostgreSQL NOTICE messages (e.g. pg_cron registration status) are
 * captured and forwarded to stdout so operators can verify that the
 * cron job was registered successfully or understand why it was
 * skipped.
 *
 * Usage:
 *   bun run scripts/apply-triggers.ts
 *   (or via the `db:triggers` / `db:dev` package scripts)
 */

import { resolve } from 'node:path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error('DATABASE_URL environment variable is not set');
}

const sqlPath = resolve(import.meta.dir, 'triggers.sql');
const sql = await Bun.file(sqlPath).text();

const client = new pg.Client({ connectionString, options: '-c timezone=UTC' });

// Capture PostgreSQL NOTICE messages raised by the script (e.g. pg_cron
// registration status, trigger attach/detach confirmations). Without this
// listener, NOTICE messages are silently swallowed by the pg driver.
const notices: string[] = [];

client.on('notice', (msg) => {
	const text = msg.message ?? String(msg);
	notices.push(text);
	console.log(`[database] NOTICE: ${text}`);
});

await client.connect();

try {
	await client.query(sql);
} finally {
	await client.end();
}

console.log('[database] triggers, audit infrastructure, and purge function applied successfully.');

if (notices.length === 0) {
	console.log('[database] no PostgreSQL NOTICE messages were emitted.');
}
