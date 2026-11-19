/**
 * What every package's `env` module is built from: the base schema each extends, loading its `.env` files, and
 * parsing them. Packages read settings only through their own `env` module, never `process.env`.
 *
 * @module env
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

/** pino's levels, for `LOG_LEVEL`. */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
/** One of {@link LOG_LEVELS}. */
export const logLevelSchema = z.enum(LOG_LEVELS);

/**
 * Loads package-scoped environment files in priority order. Earlier files
 * win: `process.loadEnvFile` never overwrites a variable that is already set.
 *
 * Under `NODE_ENV=test`, `.env.test` is loaded ahead of `.env.local` so test
 * runs never pick up developer secrets.
 *
 * @param packageDir - Absolute directory path of the package.
 * @param filenames - Optional explicit list of filenames to load.
 */
export function loadEnvFiles(packageDir: string, filenames?: string[]): void {
	const files = filenames ?? (Bun.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env.local', '.env']);
	for (const filename of files) {
		const envPath = join(packageDir, filename);
		if (existsSync(envPath)) {
			process.loadEnvFile(envPath);
		}
	}
}

/** Base Zod environment schema every package extends. */
export const baseEnvSchema = z.object({
	/** Application runtime environment. Defaults to `"development"`. */
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	LOG_LEVEL: logLevelSchema.optional(),
});

/** The settings every package has. */
export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Parses and validates environment variables against a given Zod schema.
 *
 * @param schema - The Zod schema to validate against.
 * @param rawEnv - Optional raw environment dictionary (defaults to `Bun.env`).
 * @returns Fully validated and typed environment object.
 */
export function parseEnv<T extends z.ZodTypeAny>(
	schema: T,
	rawEnv: Record<string, string | undefined> = Bun.env,
): z.infer<T> {
	return schema.parse(rawEnv);
}
