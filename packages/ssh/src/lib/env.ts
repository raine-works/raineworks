/**
 * Validated environment for `@raineworks/ssh`, parsed once at import: a setting that isn't valid stops the server
 * before it listens, saying which. The host key is read separately (`server/index` `loadHostKey`), from
 * `SSH_HOST_KEY` or `SSH_HOST_KEY_PATH`.
 *
 * @module lib/env
 */

import { baseEnvSchema, parseEnv } from '@raineworks/tools/env';
import { z } from 'zod';

const positiveInt = z.coerce.number().int().min(1);

export const envSchema = baseEnvSchema.extend({
	/** Where the server listens. */
	SSH_PORT: z.coerce.number().int().min(1).max(65_535).default(2222),
	/** Connection limits (`server/limits`); unset keeps its defaults. */
	SSH_MAX_CONNECTIONS: positiveInt.optional(),
	SSH_MAX_PER_IP: positiveInt.optional(),
	SSH_RATE_PER_IP: positiveInt.optional(),
	/** Where the contact form sends: the site's API (`bun run dev` points it at the local server). */
	RAINEWORKS_API_URL: z.url().default('https://raineworks.com'),
	/** The release the image was built for (its `VERSION` build argument); `dev` outside one. */
	VERSION: z
		.string()
		.optional()
		.transform((value) => value?.trim() || 'dev'),
});

/** The parsed settings. */
export type SshEnv = z.infer<typeof envSchema>;

/** Settings parsed once, at import: importing the module throws a `ZodError` when they are invalid. */
export const env: SshEnv = parseEnv(envSchema);
