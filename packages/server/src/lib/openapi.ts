/**
 * The OpenAPI document (3.1): `GET /api/openapi.json` is every `/api` route, as `hono-openapi` generates it from the
 * routes themselves: their requests from their validators (`lib/validate`, the same Zod schemas that check them), and
 * their responses, summaries and operation ids from `describeRoute`. Each operation is tagged by where it sits
 * (`/api/contact` → `Contact`). `bun run openapi` prints or writes the same document.
 *
 * Every route lists every response it can give, each with its body's schema: the helpers here make those, so an error
 * is always documented as the one body every refusal shares, `{ error: { code, message, details? } }`, with its code.
 *
 * @module lib/openapi
 */

import { zoneBuild } from '@raineworks/server/lib/spa';
import { ROOT_ZONE } from '@raineworks/tools/zones';
import '@raineworks/tools/prototypes';
import type { Hono } from 'hono';
import { type DescribeRouteOptions, type GenerateSpecOptions, generateSpecs, resolver } from 'hono-openapi';
import { z, type ZodType } from 'zod';

/** The body every refusal shares, with its `code` (one of `codes`) and a sentence a person can read. */
export const errorBody = (...codes: [string, ...string[]]) =>
	z
		.object({
			error: z.object({
				code: (codes.length === 1 ? z.literal(codes[0]) : z.enum(codes)).meta({
					description: 'What went wrong, for code to branch on (snake_case).',
				}),
				message: z.string().meta({
					description: 'What went wrong, as a sentence to show a person.',
					examples: ['That doesn’t look like an email address.'],
				}),
				details: z
					.unknown()
					.optional()
					.meta({ description: 'More about it, when there is more (each field’s problems).' }),
			}),
		})
		.meta({ description: 'A refusal.' });

/** One documented response, as `describeRoute` takes it. */
type Response = NonNullable<DescribeRouteOptions['responses']>[string];

/** A JSON response: its description and its body's schema. */
export const jsonResponse = (description: string, schema: ZodType): Response => ({
	description,
	content: { 'application/json': { schema: resolver(schema) } },
});

/** An error response: its description, and the codes it can carry. */
export const errorResponse = (description: string, ...codes: [string, ...string[]]): Response =>
	jsonResponse(description, errorBody(...codes));

/** The 400 every validated route can give: a request the schema refused, saying which field and why. */
export const invalidRequest: Response = errorResponse(
	'The request isn’t valid: `message` names the first problem, `details` every field’s.',
	'invalid_request',
);

/** What the document is generated with: its info and servers. Shared with `bun run openapi`. */
export const specOptions = (version: string): Partial<GenerateSpecOptions> => ({
	includeEmptyPaths: true,
	// Every validated route lists its own 400 (`invalidRequest`), with the body it really sends.
	defaultValidationErrorResponse: false,
	documentation: {
		openapi: '3.1.0',
		info: {
			title: 'raineworks API',
			version,
			description:
				'The API behind raineworks.com: what the site’s pages call. Every refusal is `{ error: { code, message, details? } }`.',
			license: { name: 'MIT', identifier: 'MIT' },
		},
		servers: [{ url: 'https://raineworks.com', description: 'Production' }],
	},
});

/** A path segment as a heading: `contact` → `Contact`. */
const label = (segment: string) => segment.charAt(0).toUpperCase() + segment.slice(1).replaceAll('-', ' ');

/** What a route is about, from its path: `/api/contact` → `Contact`, `/api/build` → `Build`. */
export function tagOf(path: string): string {
	const area = path.split('/').filter((part) => part && !part.startsWith('{'))[1];
	return area ? label(area) : 'API';
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** The document with each operation tagged by {@link tagOf}, and the tags listed. */
export function taggedSpec<T extends { paths?: Record<string, Record<string, unknown>> }>(
	spec: T,
): T & { tags: { name: string }[] } {
	const paths: Record<string, Record<string, unknown>> = {};
	for (const [path, item] of Object.entries(spec.paths ?? {})) {
		paths[path] = { ...item };
		for (const method of METHODS) {
			const operation = item[method] as Record<string, unknown> | undefined;
			if (operation) paths[path][method] = { ...operation, tags: [tagOf(path)] };
		}
	}
	const tags = Object.keys(paths)
		.map(tagOf)
		.unique()
		.sort()
		.map((name) => ({ name }));
	return { ...spec, paths, tags };
}

/** The document for `app`'s routes (the `/api` tree), generated with `version` and tagged. */
export async function generateSpec(app: Hono<never>, version: string) {
	return taggedSpec(
		(await generateSpecs(app, specOptions(version))) as never as { paths?: Record<string, Record<string, unknown>> },
	);
}

let cached: Promise<unknown> | null = null;

/** The document for `app`'s routes, made once per process (the routes don't change): its version the build served. */
export function specFor(app: Hono<never>): Promise<unknown> {
	cached ??= zoneBuild(ROOT_ZONE).then(({ version, commit }) =>
		generateSpec(app, version ? `${version}${commit ? ` (${commit})` : ''}` : 'dev'),
	);
	return cached;
}
