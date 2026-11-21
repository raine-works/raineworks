/**
 * The projects whose documentation the site renders from their repositories (`GET /api/docs/<project>`, the pages at
 * `/projects/<slug>/docs`): which repository and folder each is read from, how a page is named, and where the site
 * serves it. Shared by the server, which fetches and renders the Markdown (`lib/docs`), and the site, which links to
 * it, so the two can't disagree about what's documented. Listing a project here (and giving it a page in the site's
 * `content/projects`) is how it gets docs; the server never fetches anything else.
 *
 * @module docs
 */

/** Whose repositories. */
export const DOCS_OWNER = 'raine-works';

/** A project's documentation: its repository, branch and the folder in it. Keyed by the project's page slug. */
export const DOCS_SOURCES = {
	'ha-dashboards': { repo: 'ha-dashboards', branch: 'master', dir: 'docs' },
	'ha-googletv': { repo: 'ha-googletv', branch: 'master', dir: 'docs' },
	'ha-grok': { repo: 'ha-grok', branch: 'master', dir: 'docs' },
	'ha-music-assistant': { repo: 'ha-music-assistant', branch: 'master', dir: 'docs' },
	'ha-everscent': { repo: 'ha-everscent', branch: 'master', dir: 'docs' },
	'ha-warden': { repo: 'ha-warden', branch: 'master', dir: 'docs' },
	'ha-gitops': { repo: 'ha-gitops', branch: 'master', dir: 'docs' },
} as const;

/** A key of {@link DOCS_SOURCES}. */
export type DocsProject = keyof typeof DOCS_SOURCES;

/** Whether `slug` is a project with documentation. */
export const isDocsProject = (slug: string): slug is DocsProject => Object.hasOwn(DOCS_SOURCES, slug);

/**
 * What a page's name may be: lowercase letters, digits and hyphens, in at most two segments (`installation`,
 * `reference/modules`). It's the only thing of a request that reaches the URL fetched, so nothing else (dots, `..`,
 * encoded slashes, a third segment) can.
 */
export const DOCS_PAGE_PATTERN = /^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/;

/** Whether `page` is a page name {@link DOCS_PAGE_PATTERN} allows. */
export const isDocsPage = (page: string): boolean => DOCS_PAGE_PATTERN.test(page);

/** Where the site shows a project's documentation: its index, or `page` (a name from {@link isDocsPage}). */
export function docsPath(slug: string, page?: string): string {
	return `/projects/${slug}/docs${page ? `/${page}` : ''}`;
}

/** A file of a project's repository on GitHub (`path` from the repository's root; none for its front page). */
export function docsRepoUrl(slug: DocsProject, path = ''): string {
	const { repo, branch } = DOCS_SOURCES[slug];
	return path
		? `https://github.com/${DOCS_OWNER}/${repo}/blob/${branch}/${path}`
		: `https://github.com/${DOCS_OWNER}/${repo}`;
}
