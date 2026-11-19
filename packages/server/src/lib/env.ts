/**
 * Validated environment for `@raineworks/server`.
 *
 * Loads `packages/server/.env.local` (or `.env.test` under `bun test`) before parsing.
 *
 * Fails closed: `NODE_ENV` unset is production here, not development, so what only development allows (listening
 * on loopback only, HTML never cached) needs `NODE_ENV` set on purpose (`bun run dev` sets `development`).
 *
 * @module lib/env
 */

import { join } from 'node:path';

import { baseEnvSchema, loadEnvFiles, parseEnv } from '@raineworks/tools/env';
import { z } from 'zod';

loadEnvFiles(join(import.meta.dir, '../..'));

/** Development or tests, set explicitly (unset is production). */
export const isLocal = (nodeEnv: string): boolean => nodeEnv === 'development' || nodeEnv === 'test';

/** The server's settings. Outside development and tests the server listens on every interface unless told otherwise. */
export const envSchema = baseEnvSchema
	.extend({
		/** Unset is `production`: see the module comment. */
		NODE_ENV: baseEnvSchema.shape.NODE_ENV.unwrap().default('production'),
		PORT: z.coerce.number().int().min(0).max(65_535).default(3032),
		/**
		 * The address to listen on. Unset is `127.0.0.1` in development and tests (this machine only) and `0.0.0.0`
		 * (every interface) otherwise. Set `0.0.0.0` to reach a local server from another machine or a container.
		 */
		HOST: z.string().min(1).optional(),
		/** Serve the zones' builds from `<WEB_DIST>/<zone>` instead of each `packages/web-<zone>/dist`. */
		WEB_DIST: z.string().optional(),
		/**
		 * How long the server keeps serving after SIGTERM, `/readyz` failing, before it stops taking connections, so
		 * load balancers take it out first (`lib/shutdown`). Unset is 5 seconds in production, none in development and
		 * tests.
		 */
		SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).optional(),
		/**
		 * An X API bearer token (app-only), for Raine's articles on X (`lib/x`). Unset turns them off entirely: no
		 * `/articles` page or `/feed.xml`, and `/api/articles` says they're off.
		 */
		X_BEARER_TOKEN: z
			.string()
			.optional()
			.transform((value) => value?.trim() || undefined),
	})
	.transform((data) => ({
		...data,
		HOST: data.HOST ?? (isLocal(data.NODE_ENV) ? '127.0.0.1' : '0.0.0.0'),
		SHUTDOWN_DRAIN_MS: data.SHUTDOWN_DRAIN_MS ?? (isLocal(data.NODE_ENV) ? 0 : 5_000),
	}));

/** The parsed settings. */
export type ServerEnv = z.infer<typeof envSchema>;

/** Settings parsed once, at import: importing the module throws a `ZodError` when they are invalid. */
export const env: ServerEnv = parseEnv(envSchema);
