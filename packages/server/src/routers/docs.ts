/**
 * `GET /api/docs/<project>`: a project's documentation page, rendered from its repository (`lib/docs`), for the site's
 * `/projects/<slug>/docs` pages. Only the projects in `DOCS_SOURCES` have any, and only the docs folder's pages are
 * ever fetched.
 *
 * @module routers/docs
 */

import { DOCS_TTL_MS, docsPage } from '@raineworks/server/lib/docs';
import { errorResponse, invalidRequest, jsonResponse } from '@raineworks/server/lib/openapi';
import { validate } from '@raineworks/server/lib/validate';
import { DOCS_PAGE_PATTERN, isDocsProject } from '@raineworks/tools/docs';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';

/** What `GET /api/docs/<project>` answers. */
export const docsPageSchema = z
	.object({
		title: z.string().meta({ description: 'The page’s title: its first heading.', examples: ['Installation'] }),
		html: z.string().meta({
			description:
				'The page as HTML, without its title. Raw HTML in the Markdown is refused (shown as text), links to other pages are the site’s routes, and external links open in a new tab.',
		}),
		headings: z
			.array(
				z.object({
					id: z.string().meta({ description: 'The heading’s anchor.', examples: ['the-integration'] }),
					text: z.string().meta({ description: 'The heading’s text.', examples: ['The integration'] }),
					level: z.union([z.literal(2), z.literal(3)]).meta({ description: 'Its level: `##` or `###`.' }),
				}),
			)
			.meta({ description: 'The page’s `##` and `###` headings, for its contents.' }),
		nav: z
			.array(
				z.object({
					title: z.string().meta({ description: 'The page’s name in the index.', examples: ['Installation'] }),
					page: z.string().meta({ description: 'Its page name.', examples: ['installation'] }),
					group: z
						.string()
						.meta({ description: 'The index’s table it’s in; empty when not in one.', examples: ['Guide'] }),
				}),
			)
			.meta({
				description: 'The pages the project’s index lists, in its order. Empty while the index isn’t available.',
			}),
		file: z.string().meta({ description: 'The page’s file in the repository.', examples: ['docs/installation.md'] }),
		fetchedAt: z.iso.datetime().meta({ description: 'When GitHub was asked.', examples: ['2026-11-21T12:00:00.000Z'] }),
	})
	.meta({ description: 'A documentation page.' });

const paramSchema = z.object({
	project: z
		.string()
		.min(1)
		.max(64)
		.meta({ description: 'The project’s page slug.', examples: ['ha-dashboards'] }),
});

const querySchema = z.object({
	page: z
		.string()
		.regex(DOCS_PAGE_PATTERN, 'A page is named with lowercase letters, digits and hyphens, in at most two parts.')
		.optional()
		.meta({
			description: 'The page’s name: lowercase letters, digits and hyphens, at most one `/`. The index when left out.',
			examples: ['installation', 'reference/modules'],
		}),
});

/** Mounted at `/api/docs`. */
export const docsRouter = new Hono().get(
	'/:project',
	describeRoute({
		operationId: 'getDocsPage',
		summary: 'A project’s documentation page',
		description:
			'A page of a project’s docs folder on GitHub, rendered as HTML, with the navigation its index gives. Only projects with documentation have any (a 404 otherwise), and only pages named with lowercase letters, digits and hyphens, at most one `/` deep, are fetched. GitHub is asked at most every five minutes per page; when it doesn’t answer, the last copy; with none, a 503.',
		responses: {
			200: jsonResponse('The page.', docsPageSchema),
			400: invalidRequest,
			404: errorResponse('The project has no documentation, or no such page.', 'docs_not_found'),
			503: errorResponse('GitHub couldn’t be reached, and there’s no copy from before.', 'docs_unavailable'),
			500: errorResponse('Something went wrong on the server.', 'internal_error'),
		},
	}),
	validate('param', paramSchema),
	validate('query', querySchema),
	async (c) => {
		const { project } = c.req.valid('param');
		const { page } = c.req.valid('query');
		if (!isDocsProject(project)) {
			return c.json({ error: { code: 'docs_not_found', message: 'There’s no documentation for that project.' } }, 404);
		}
		const result = await docsPage(project, page);
		if (result.kind === 'missing') {
			return c.json({ error: { code: 'docs_not_found', message: 'There’s no such page.' } }, 404);
		}
		if (result.kind === 'unavailable') {
			c.header('Cache-Control', 'no-store');
			return c.json(
				{ error: { code: 'docs_unavailable', message: 'The documentation isn’t available right now.' } },
				503,
			);
		}
		c.header('Cache-Control', `public, max-age=${DOCS_TTL_MS / 1000}`);
		return c.json(result.page, 200);
	},
);
