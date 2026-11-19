/**
 * The settings build-time tools read (`@raineworks/tools/build`, `@raineworks/tools/version`), validated like every
 * package's `env` module (`@raineworks/tools/env`). They run before any service's env exists (a zone's build, an image's
 * `docker build`), so they have this small reader of their own rather than a service's.
 *
 * Read on each call, not once at import: a build's settings are the process's when it builds.
 *
 * @module build-env
 */

import { baseEnvSchema, parseEnv } from '@raineworks/tools/env';
import { z } from 'zod';

/** Blank counts as unset: an image's build passes `RAINEWORKS_VERSION=` when it isn't given `VERSION`. */
const optional = z
	.string()
	.optional()
	.transform((value) => (value?.trim() ? value.trim() : undefined));

/** What a build reads from the environment. */
export const buildEnvSchema = baseEnvSchema.pick({ NODE_ENV: true }).extend({
	/** The version being built (CI, an image's `VERSION`); else the newest release note's. */
	RAINEWORKS_VERSION: optional,
	/** The commit being built (CI, an image's `GIT_SHA`, where there's no `.git`); else git's. */
	RAINEWORKS_COMMIT: optional,
});

/** A build's settings. */
export type BuildEnv = z.infer<typeof buildEnvSchema>;

/**
 * The build's settings, from `rawEnv` (the process's by default). Throws (a `ZodError`) on a `NODE_ENV` that isn't
 * `development`, `production` or `test`.
 */
export function buildEnv(rawEnv: Record<string, string | undefined> = Bun.env): BuildEnv {
	return parseEnv(buildEnvSchema, rawEnv);
}
