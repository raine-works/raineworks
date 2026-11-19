/**
 * Markdown rendered at build time with Bun's Markdown renderer, so zones ship
 * HTML and no Markdown parser: the developers zone's guides, and every zone's
 * release notes.
 *
 * - `import doc from './x.md'` is a {@link RenderedDoc}: its frontmatter
 *   (`title`, `description`, `order`, `date`, and the rest in `meta`), its
 *   HTML, and its `##` / `###` headings for "On this page".
 * - A collection (`markdownPlugin([{ module: 'raineworks:guides', dir, sort }])`) is a
 *   virtual module listing every `.md` in `dir` (by `order`, or newest `date`
 *   first), each with a `load()` that imports it: one chunk per document.
 *
 * The documents are the project's own text: raw HTML in them is refused, not passed
 * through, and a link or image may only point at `http:`, `https:`, `mailto:` or
 * a relative URL (anything else becomes `#`). Code blocks are coloured
 * (`highlight`) and labelled; `> [!NOTE]` and its kin become callouts.
 *
 * @module markdown
 */

import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { compareVersions } from '@raineworks/tools/calver';
import { highlight } from '@raineworks/tools/highlight';
import type { BunPlugin } from 'bun';
import '@raineworks/tools/prototypes';

/** A document's frontmatter as the pages list it: `title` falls back to its slug, `order` to 100. */
export interface DocMeta {
	slug: string;
	title: string;
	description: string;
	order: number;
	/** `YYYY-MM-DD`, for what's dated (a release note); `''` otherwise. */
	date: string;
	/** Every frontmatter field, as written. */
	meta: Record<string, string>;
	/** The zones any part of it is for (`::: for …` blocks); `null`: everyone (some of it isn't scoped). */
	zones: string[] | null;
}

/** A document rendered to HTML, whole and in its parts, with the headings for its contents. */
export interface RenderedDoc extends DocMeta {
	/** Its parts (`::: for <zones>` blocks, `splitScopes`), each with the zones it's for (`null`: everyone). */
	sections: Array<{ zones: string[] | null; html: string }>;
	html: string;
	headings: Array<{ id: string; text: string; level: 2 | 3 }>;
}

/** A guide's frontmatter (`key: value` lines between `---`) and the Markdown after it. */
export function splitFrontmatter(source: string): { meta: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
	if (!match) return { meta: {}, body: source };
	const meta: Record<string, string> = {};
	for (const line of (match[1] ?? '').split(/\r?\n/)) {
		const at = line.indexOf(':');
		if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
	}
	return { meta, body: source.slice(match[0].length) };
}

const unescapeHtml = (html: string) =>
	html
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');

const stripTags = (html: string) =>
	html
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");

type CalloutKind = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';
const CALLOUT_TITLES: Record<CalloutKind, string> = {
	NOTE: 'Note',
	TIP: 'Tip',
	IMPORTANT: 'Important',
	WARNING: 'Warning',
	CAUTION: 'Caution',
};

/** How a code block's language is labelled (a `Map`: a block marked `constructor` never gets an inherited property). */
const LANGUAGE_LABELS = new Map([
	['bash', 'Shell'],
	['sh', 'Shell'],
	['json', 'JSON'],
	['ts', 'TypeScript'],
	['typescript', 'TypeScript'],
	['js', 'JavaScript'],
	['javascript', 'JavaScript'],
	['python', 'Python'],
	['http', 'HTTP'],
	['text', 'Text'],
]);

/** The schemes a link or image may use; a URL without one (relative, `/…`, `#…`) is always allowed. */
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	colon: ':',
	tab: '\t',
	newline: '\n',
};

/**
 * An `href` / `src` value as rendered, or `#` when a browser would read a scheme other than {@link SAFE_SCHEMES} in it.
 * Decoded first as the browser does: entities (`&#106;avascript:`), then the whitespace and control characters it
 * ignores (`java\tscript:`, a leading space), so no spelling of `javascript:` gets through.
 */
function safeUrl(escaped: string): string {
	const decoded = escaped.replace(/&(#x[\da-f]+|#\d+|[a-z]+);?/gi, (entity, name: string) => {
		const lower = name.toLowerCase();
		if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) % 0x110000);
		if (lower.startsWith('#')) return String.fromCodePoint(Number(lower.slice(1)) % 0x110000);
		return Object.hasOwn(NAMED_ENTITIES, lower) ? (NAMED_ENTITIES[lower] as string) : entity;
	});
	// \x00-\x20 and \x7f: the C0 controls, space and DEL, which URL parsing trims or drops.
	const scheme = /^([a-z][a-z\d+.-]*):/i.exec(decoded.replace(/[\x00-\x20\x7f]/g, ''))?.[1];
	return scheme === undefined || SAFE_SCHEMES.has(scheme.toLowerCase()) ? escaped : '#';
}

/** Markdown as HTML: raineworks’ flavour (heading links, scrolling tables, coloured and labelled code, callouts). */
function renderHtml(markdown: string): string {
	return (
		Bun.markdown
			.html(markdown, {
				// Ids, and each heading a link to itself (`#` on hover: styles.css).
				headings: true,
				autolinks: true,
				tables: true,
				noHtmlBlocks: true,
				noHtmlSpans: true,
				tagFilter: true,
			})
			// A wide table scrolls inside the page, never the page itself.
			.replace(/<table>/g, '<div class="table-scroll"><table>')
			.replace(/<\/table>/g, '</table></div>')
			// `<https://…>` autolinks are raw HTML to a renderer told to refuse it (`noHtmlSpans`), so they come out as
			// text: make them links here, leaving code alone.
			.replace(
				/(<code\b[\s\S]*?<\/code>)|&lt;((?:https?:\/\/|mailto:)(?:[^\s<>"&]|&amp;)+)&gt;/gi,
				(_, code: string | undefined, url: string | undefined) => code ?? `<a href="${url}">${url}</a>`,
			)
			// Links and images only to the web, mail or this site, never `javascript:` and its kin.
			.replace(
				/(<(?:a|img)\s[^>]*?\b(?:href|src)=")([^"]*)"/g,
				(_, before: string, url: string) => `${before}${safeUrl(url)}"`,
			)
			// Code blocks coloured now (the zone ships no highlighter for them), each labelled with its language.
			.replace(
				/<pre><code class="language-([\w-]+)">([\s\S]*?)<\/code><\/pre>/g,
				(_, language: string, escaped: string) =>
					`<div class="code-block"><div class="code-label">${LANGUAGE_LABELS.get(language) ?? language}</div><pre><code class="hljs language-${language}">${highlight(unescapeHtml(escaped), language)}</code></pre></div>`,
			)
			// One without a language gets the same bar (as text), so its copy button never sits on the code.
			.replace(
				/<pre><code>([\s\S]*?)<\/code><\/pre>/g,
				(_, escaped: string) =>
					`<div class="code-block"><div class="code-label">Text</div><pre><code class="hljs">${escaped}</code></pre></div>`,
			)
			// GitHub's alerts (`> [!NOTE]` as a blockquote's first line) as callouts.
			.replace(
				/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)<\/blockquote>/g,
				(_, kind: CalloutKind, rest: string) =>
					`<aside class="callout callout-${kind.toLowerCase()}" role="note"><p class="callout-title">${CALLOUT_TITLES[kind]}</p><p>${rest.trim()}</aside>`,
			)
	);
}

/**
 * The document's parts and who each is for: `::: for admin` opens a part only those zones see, `:::`
 * closes it, and anything outside one is everyone's (`zones: null`). Empty parts are left out. A marker is one
 * however far its line is indented: under a list, an editor or a formatter indents it to the list's text, and read
 * as text there it would show (`:::`) and leave its part open.
 */
export function splitScopes(markdown: string): Array<{ zones: string[] | null; markdown: string }> {
	const parts: Array<{ zones: string[] | null; lines: string[] }> = [{ zones: null, lines: [] }];
	for (const line of markdown.split(/\r?\n/)) {
		const opens = /^\s*:::\s*for\s+(.+?)\s*$/.exec(line);
		if (opens) {
			parts.push({
				zones: (opens[1] ?? '')
					.split(',')
					.map((zone) => zone.trim())
					.filter(Boolean),
				lines: [],
			});
		} else if (/^\s*:::\s*$/.test(line)) {
			parts.push({ zones: null, lines: [] });
		} else {
			(parts.at(-1) as { lines: string[] }).lines.push(line);
		}
	}
	return parts
		.map((part) => ({ zones: part.zones, markdown: part.lines.join('\n') }))
		.filter((part) => !part.markdown.trim().isEmpty());
}

/** Renders one document: HTML with heading ids, tables that scroll on their own, and its headings. */
export function renderDoc(slug: string, source: string): RenderedDoc {
	const { meta, body } = splitFrontmatter(source);
	const sections = splitScopes(body).map(({ zones, markdown }) => ({ zones, html: renderHtml(markdown) }));
	const html = sections.map((section) => section.html).join('');
	const headings = [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map((match) => ({
		level: Number(match[1]) as 2 | 3,
		id: match[2] ?? '',
		text: stripTags(match[3] ?? '').trim(),
	}));
	return {
		slug,
		title: meta.title ?? slug,
		description: meta.description ?? '',
		order: Number(meta.order ?? 100),
		date: meta.date ?? '',
		meta,
		// Who it's for: everyone, once any of it is unscoped; else the zones its sections name.
		zones: sections.some((section) => section.zones === null)
			? null
			: sections.flatMap((section) => section.zones ?? []).unique(),
		html,
		sections,
		headings,
	};
}

/** A virtual module listing a directory's documents. */
export interface MarkdownCollection {
	/** What it's imported as, e.g. `raineworks:guides`. */
	module: string;
	dir: string;
	/** By `order` (then title), newest `date` first, or newest version first (files named by version: release notes). */
	sort: 'order' | 'newest' | 'version';
}

/** Loads `.md` files as rendered documents, and each collection as the list of those in its directory. */
export function markdownPlugin(collections: readonly MarkdownCollection[]): BunPlugin {
	return {
		name: 'raineworks-markdown',
		setup(build) {
			build.onLoad({ filter: /\.md$/ }, async ({ path }) => ({
				contents: `export default ${JSON.stringify(renderDoc(basename(path, '.md'), await Bun.file(path).text()))};`,
				loader: 'js',
			}));
			for (const collection of collections) {
				const filter = new RegExp(`^${collection.module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
				const namespace = `raineworks-markdown-${collection.module.replace(/\W/g, '-')}`;
				build.onResolve({ filter }, () => ({ path: collection.module, namespace }));
				build.onLoad({ filter: /.*/, namespace }, async () => ({
					contents: await collectionModule(collection),
					loader: 'js',
				}));
			}
		},
	};
}

/** A collection's module: `export const docs = [{ ...meta, load }]`, sorted. */
async function collectionModule(collection: MarkdownCollection): Promise<string> {
	const files = existsSync(collection.dir) ? readdirSync(collection.dir).filter((file) => file.endsWith('.md')) : [];
	const docs = await Promise.all(
		files.map(async (file) => {
			const {
				html: _html,
				headings: _headings,
				...meta
			} = renderDoc(basename(file, '.md'), await Bun.file(join(collection.dir, file)).text());
			return { ...meta, path: join(collection.dir, file) };
		}),
	);
	docs.sort((a, b) =>
		collection.sort === 'version'
			? compareVersions(b.slug, a.slug)
			: collection.sort === 'newest'
				? b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug)
				: a.order - b.order || a.title.localeCompare(b.title),
	);
	const entries = docs.map(
		({ path, ...meta }) => `{ ...${JSON.stringify(meta)}, load: () => import(${JSON.stringify(path)}) }`,
	);
	return `export const docs = [${entries.join(',\n')}];`;
}
