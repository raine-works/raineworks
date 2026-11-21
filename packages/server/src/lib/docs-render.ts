/**
 * A project's documentation page as the site shows it: its Markdown (third-party content, fetched from the project's
 * repository by `lib/docs`) as HTML, its title, the links between its pages, and the navigation the project's index
 * page gives. Pure: no network, so each rule is tested on its own (`docs-render.test.ts`).
 *
 * - **Never raw HTML.** It's rendered with `@raineworks/tools/markdown`, which refuses HTML in the Markdown (it comes
 *   out as text) and links to anything but the web and mail. HTML comments are removed first, outside code (generated
 *   pages start with one saying how they were made).
 * - **Links** (`resolveDocsLink`): relative ones are resolved from the page's own file; those landing on another page
 *   of the project's docs folder become that page's route on the site, anything else in the repository a link to the
 *   file on GitHub, and external ones open in a new tab.
 * - The first `#` heading is the page's title, taken out of the body (the site's page heading says it).
 *
 * @module lib/docs-render
 */

import { DOCS_OWNER, DOCS_SOURCES, docsPath, type DocsProject, docsRepoUrl, isDocsPage } from '@raineworks/tools/docs';
import { renderDoc, type RenderedDoc } from '@raineworks/tools/markdown';
import { tryCatch } from '@raineworks/tools/prototypes';

/** A page the project's index lists, for the navigation beside every page. */
export interface DocsNavItem {
	title: string;
	/** The page's name, as `GET /api/docs/<project>?page=` takes it. */
	page: string;
	/** The table or list it's in on the index ("Guide", "Reference"); empty when it's not in one. */
	group: string;
}

/** A page ready to show. */
export interface RenderedDocsPage {
	title: string;
	html: string;
	headings: RenderedDoc['headings'];
}

/** The repository file for a page (`undefined` is the index, the folder's `README.md`). */
export function docsFile(slug: DocsProject, page?: string): string {
	return `${DOCS_SOURCES[slug].dir}/${page ?? 'README'}.md`;
}

/** Where `file` is in the repository, as the base of a relative link: a made-up host, only its path is read. */
const repoBase = (file: string) => new URL(file, 'https://repository.invalid/');

/** Runs `fn` over the parts of `markdown` outside fenced code blocks, leaving the fences as they are. */
function outsideFences(markdown: string, fn: (text: string) => string): string {
	const out: string[] = [];
	let text: string[] = [];
	let fence: string | null = null;
	const flush = () => {
		if (text.isEmpty()) return;
		out.push(fn(text.join('\n')));
		text = [];
	};
	for (const line of markdown.split(/\r?\n/)) {
		const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence === null && marker) {
			flush();
			fence = marker;
			out.push(line);
		} else if (fence !== null) {
			out.push(line);
			if (marker && marker.startsWith(fence[0] as string) && marker.length >= fence.length) fence = null;
		} else {
			text.push(line);
		}
	}
	flush();
	return out.join('\n');
}

/** `markdown` without its HTML comments (outside fenced code, where they're text). */
export function stripHtmlComments(markdown: string): string {
	return outsideFences(markdown, (text) => text.replace(/<!--[\s\S]*?-->/g, ''));
}

/** Markdown's own marks off a heading or link text: `` `code` ``, emphasis and links keep only their words. */
const plainText = (text: string): string =>
	text
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[`*_]/g, '')
		.trim();

/** A page's name as a title when it has no heading: `reference/modules` → "Modules". */
function titleFromPage(page?: string): string {
	const last = (page?.split('/').at(-1) ?? 'docs').replaceAll('-', ' ');
	return last.charAt(0).toUpperCase() + last.slice(1);
}

/** The page's title (its first `#` heading, when only blank lines come before it) and the Markdown without that line. */
export function splitTitle(markdown: string): { title: string | null; body: string } {
	const lines = markdown.split(/\r?\n/);
	const at = lines.findIndex((line) => !line.trim().isEmpty());
	const match = at === -1 ? null : /^#\s+(.+?)\s*#*\s*$/.exec(lines[at] as string);
	if (!match) return { title: null, body: markdown };
	return { title: plainText(match[1] as string), body: lines.slice(at + 1).join('\n') };
}

/** `href` as an HTML attribute holds it: only `&` is escaped by the renderer, and `"` can't occur in it. */
const unescapeAttribute = (value: string) => value.replaceAll('&amp;', '&');
const escapeAttribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** Where a relative link lands in the repository: its path from the root, and its query and fragment. */
function repoTarget(href: string, file: string): { path: string; suffix: string } | null {
	if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return null;
	const { data: url, error } = tryCatch(() => new URL(href, repoBase(file)));
	if (error) return null;
	return { path: url.pathname.slice(1), suffix: `${url.search}${url.hash}` };
}

/** A link as the site shows it: where it goes, and whether that's away from the site. */
export interface ResolvedLink {
	href: string;
	external: boolean;
}

/**
 * Where a link in `file` (a file of the project's repository) goes on the site. `#heading` stays; a page of the docs
 * folder (`installation.md`, `../docs/reference/modules.md`, the folder itself or its `README.md`) is its route; any
 * other file of the repository is its page on GitHub (a link above the root stops at it); an absolute URL is itself.
 */
export function resolveDocsLink(href: string, slug: DocsProject, file: string): ResolvedLink {
	if (href.startsWith('#')) return { href, external: false };
	const target = repoTarget(unescapeAttribute(href), file);
	if (!target) return { href, external: !/^mailto:/i.test(href) };
	const { dir } = DOCS_SOURCES[slug];
	const { path, suffix } = target;
	const fragment = suffix.slice(suffix.indexOf('#') === -1 ? suffix.length : suffix.indexOf('#'));
	const trimmed = path.replace(/\/$/, '');
	if (trimmed === dir || path === `${dir}/README.md`) return { href: docsPath(slug) + fragment, external: false };
	const page = path.startsWith(`${dir}/`) && path.endsWith('.md') ? path.slice(dir.length + 1, -'.md'.length) : null;
	if (page !== null && isDocsPage(page)) return { href: docsPath(slug, page) + fragment, external: false };
	return { href: docsRepoUrl(slug, path) + suffix, external: true };
}

/**
 * An image's address: a file of the repository is served by GitHub, an `https:` one is itself, and anything else (an
 * `http:` or other scheme) is none: it's shown as its alt text instead, never fetched.
 */
function imageUrl(src: string, slug: DocsProject, file: string): string | null {
	const decoded = unescapeAttribute(src);
	const target = repoTarget(decoded, file);
	if (target) {
		const { repo, branch } = DOCS_SOURCES[slug];
		return escapeAttribute(`https://raw.githubusercontent.com/${DOCS_OWNER}/${repo}/${branch}/${target.path}`);
	}
	return /^https:\/\//i.test(decoded) ? src : null;
}

/** The rendered HTML with its links and images pointed where they should go (images lazy, with their alt text). */
function rewriteLinks(html: string, slug: DocsProject, file: string): string {
	return html
		.replace(/<a href="([^"]*)"/g, (_, href: string) => {
			const link = resolveDocsLink(href, slug, file);
			return `<a href="${escapeAttribute(link.href)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
		})
		.replace(/<img src="([^"]*)"([^>]*?)\s*\/?>/g, (_, src: string, rest: string) => {
			const url = imageUrl(src, slug, file);
			if (url === null) return /alt="([^"]*)"/.exec(rest)?.[1] ?? '';
			return `<img src="${url}"${rest} loading="lazy" decoding="async" />`;
		});
}

/** A project's page (`page` undefined: its index) from its Markdown, ready to show. */
export function renderDocsPage(slug: DocsProject, page: string | undefined, source: string): RenderedDocsPage {
	const { title, body } = splitTitle(stripHtmlComments(source));
	const doc = renderDoc(page ?? 'README', body);
	return {
		title: title ?? titleFromPage(page),
		html: rewriteLinks(doc.html, slug, docsFile(slug, page)),
		headings: doc.headings,
	};
}

/**
 * The pages an index page links to, in its order, with the table (or the line above a list) each is in: the
 * project's own table of contents, so the navigation follows the docs and nothing is kept on the site.
 */
export function docsNav(slug: DocsProject, indexSource: string): DocsNavItem[] {
	const items: DocsNavItem[] = [];
	const file = docsFile(slug);
	let group = '';
	outsideFences(stripHtmlComments(indexSource), (text) => {
		const rows = text.split('\n');
		for (const [index, line] of rows.entries()) {
			if (!line.trimStart().startsWith('|')) continue;
			const first = line.trim().replace(/^\|/, '').split('|')[0]?.trim() ?? '';
			if (/^\|?\s*:?-+/.test(rows[index + 1]?.trim() ?? '')) {
				group = plainText(first).replace(/\s*\(.*\)$/, '');
				continue;
			}
			for (const match of first.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
				const link = resolveDocsLink(match[2] as string, slug, file);
				const page = link.external ? null : link.href.slice(docsPath(slug).length + 1).replace(/#.*$/, '');
				if (page && !items.some((item) => item.page === page))
					items.push({ title: plainText(match[1] as string), page, group });
			}
		}
		return text;
	});
	return items;
}
