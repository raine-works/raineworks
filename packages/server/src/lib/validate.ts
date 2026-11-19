/**
 * Request validation with the API's error shape: a request a schema refuses gets a 400
 * `{ error: { code: 'invalid_request', message, details } }`, `message` naming the first problem (the schema's own
 * sentence) and `details` every field's.
 *
 * Built on `hono-openapi`'s validator, so every validated route also documents its query or body in
 * `GET /api/openapi.json` from the same schema that checks it (`lib/openapi`). Its result is `c.req.valid(target)`.
 *
 * @module lib/validate
 */

import type { Env, ValidationTargets } from 'hono';
import { validator } from 'hono-openapi';
import { z, type ZodType } from 'zod';

/** Validates `target` against `schema`, answering a 400 `invalid_request` when it doesn't hold. */
export function validate<Target extends keyof ValidationTargets, Schema extends ZodType>(
	target: Target,
	schema: Schema,
): ReturnType<typeof validator<Schema, Target, Env, string>> {
	return validator<Schema, Target, Env, string>(target, schema, (result, c) => {
		if (result.success) return;
		// Every schema here is Zod, so the Standard Schema issues are Zod's.
		const error = new z.ZodError(result.error as z.core.$ZodIssue[]);
		return c.json(
			{
				error: {
					code: 'invalid_request' as const,
					message: error.issues[0]?.message ?? 'Check the request and try again.',
					details: z.flattenError(error).fieldErrors,
				},
			},
			400,
		);
	});
}
