/**
 * Prisma 7 configuration file.
 *
 * This replaces the old `datasource.url` field that used to live inside
 * `schema.prisma`. All CLI commands (`migrate`, `generate`, `studio`, etc.)
 * read connection details from here.
 *
 * Bun loads `.env` files automatically so there is no need to import `dotenv`.
 */

import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		url: process.env.DATABASE_URL
	}
});
