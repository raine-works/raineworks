/**
 * Validated environment variables.
 *
 * Parses `Bun.env` through a Zod schema at import time so the
 * server fails fast with a clear, human-readable error if any
 * required variable is missing or malformed.
 *
 * Every module in the server package should import `env` from this
 * file instead of accessing `process.env` or `Bun.env` directly.
 *
 * @module env
 */

import { z } from 'zod';

/** Valid Pino log levels. */
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export const envSchema = z
	.object({
		/** Application environment. Defaults to `"development"`. */
		NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

		/**
		 * Pino log level.
		 *
		 * Controls the minimum severity that is emitted. When omitted,
		 * defaults to `"debug"` in development and `"info"` otherwise.
		 */
		LOG_LEVEL: z.enum(LOG_LEVELS).optional(),

		/**
		 * PostgreSQL connection string.
		 *
		 * Used by the Prisma client, the DatabaseListener, migrations,
		 * and trigger scripts.
		 */
		DATABASE_URL: z.url(),

		/**
		 * Secret used to sign and verify JWT access tokens (HMAC-SHA256).
		 *
		 * Must be at least 32 characters of high entropy. In production,
		 * generate with: `openssl rand -base64 48`
		 */
		JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

		/**
		 * Root directory containing the built frontend bundles.
		 *
		 * Expected layout:
		 * ```
		 * <STATIC_DIR>/
		 *   ├── web/    — shell zone (base "/")
		 *   └── docs/   — docs zone (base "/docs")
		 * ```
		 *
		 * In production this points to a mounted volume on the pod
		 * (e.g. `/var/www`). When omitted, falls back to the monorepo
		 * `packages/` directory relative to the server source — this
		 * is the default for local development where `bun run build`
		 * places bundles in each package's `dist/` folder.
		 */
		STATIC_DIR: z.string().optional(),

		// -------------------------------------------------------------------
		// OIDC provider credentials (optional — omit to disable a provider)
		// -------------------------------------------------------------------

		/**
		 * Google OAuth 2.0 / OIDC client ID.
		 *
		 * Obtain from the Google Cloud Console → APIs & Services → Credentials.
		 * When omitted, Google sign-in is disabled.
		 */
		GOOGLE_CLIENT_ID: z.string().optional(),

		/**
		 * Google OAuth 2.0 / OIDC client secret.
		 *
		 * Must be provided alongside `GOOGLE_CLIENT_ID`.
		 */
		GOOGLE_CLIENT_SECRET: z.string().optional(),

		/**
		 * GitHub OAuth 2.0 client ID.
		 *
		 * Obtain from GitHub → Settings → Developer Settings → OAuth Apps.
		 * When omitted, GitHub sign-in is disabled.
		 */
		GITHUB_CLIENT_ID: z.string().optional(),

		/**
		 * GitHub OAuth 2.0 client secret.
		 *
		 * Must be provided alongside `GITHUB_CLIENT_ID`.
		 */
		GITHUB_CLIENT_SECRET: z.string().optional(),

		// -------------------------------------------------------------------
		// WebAuthn Relying Party configuration (required for passkey support)
		// -------------------------------------------------------------------

		/**
		 * WebAuthn Relying Party identifier.
		 *
		 * Typically the bare domain name without scheme or port:
		 * - Development: `"localhost"`
		 * - Production:  `"example.com"`
		 *
		 * Must match the `origin` exactly or be a registrable domain
		 * suffix of it. Required for passkey registration and
		 * authentication ceremonies.
		 */
		RP_ID: z.string().default('localhost'),

		/**
		 * Human-readable name of the Relying Party.
		 *
		 * Shown to the user by the authenticator or browser during
		 * passkey registration (e.g. "RaineStack").
		 */
		RP_NAME: z.string().default('RaineStack'),

		/**
		 * Full origin URL of the Relying Party.
		 *
		 * Must include the scheme and port (if non-standard):
		 * - Development: `"http://localhost:3000"`
		 * - Production:  `"https://example.com"`
		 *
		 * Used during WebAuthn ceremony verification to validate that
		 * the authenticator response was generated for this origin.
		 */
		RP_ORIGIN: z.string().default('http://localhost:3000')
	})
	.transform((parsed) => ({
		...parsed,
		LOG_LEVEL: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === 'development' ? ('debug' as const) : ('info' as const))
	}));

export type Env = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment variables.
 *
 * If validation fails, Zod will throw a `ZodError` with details
 * about every missing or invalid variable — this surfaces during
 * server startup before any requests are accepted.
 */
export const env: Env = envSchema.parse(Bun.env);
