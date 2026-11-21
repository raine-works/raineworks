/**
 * A page's `<head>`: its title, its description, and how it unfurls when it's shared (Open Graph and X cards, with
 * the site's share image), written into each page as it's prerendered (`app/prerender`). Every route declares its own
 * as `staticData.head`, so search engines and link previews see each page for what it is before any script runs.
 *
 * @module lib/head
 */

import { APP_NAME, SITE_URL } from '@raineworks/ui/lib/brand';

/** What a page says about itself (`staticData: { head }` on its route). */
export interface PageHead {
	/** Before the site's name ("Work · raineworks"); the name alone when unset. */
	title?: string;
	/** A sentence or two, as search results and link previews show it. */
	description: string;
	/** Kept out of search results (the 404). */
	noindex?: boolean;
	/** Left out of `sitemap.xml`: a page that may be off (the articles, without an X API token). */
	unlisted?: boolean;
	/** schema.org structured data about the page, written as JSON-LD. */
	structuredData?: Record<string, unknown>;
}

/** One page of a route with parameters (`/projects/$slug`): its parameters and its head. */
export interface StaticPage {
	params: Record<string, string>;
	head: PageHead;
}

declare module '@tanstack/react-router' {
	interface StaticDataRouteOption {
		head?: PageHead;
		/** A route with parameters: every page it has, each prerendered with its own head. Without it, none is. */
		pages?: StaticPage[];
	}
}

/** `path` with its `$name` segments filled in from `params`; throws for one `params` doesn't give. */
export function interpolatePath(path: string, params: Record<string, string>): string {
	return path.replace(/\$(\w+)/g, (_, name: string) => {
		const value = params[name];
		if (value === undefined) throw new Error(`${path} needs the parameter ${name}.`);
		return encodeURIComponent(value);
	});
}

/** The site's share image (`assets/og-image.png`): its file name in a zone's build, size and what it shows. */
export const SHARE_IMAGE = {
	file: 'og-image.png',
	width: 1200,
	height: 630,
	alt: 'The raineworks logo, with “Raine Petersen: software, systems and open source” and raineworks.com.',
} as const;

/** A tab's title: "<title> · raineworks", or the name alone. */
export const documentTitle = (title?: string): string => (title ? `${title} · ${APP_NAME}` : APP_NAME);

const escapeAttribute = (text: string) =>
	text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

/** JSON for a `<script>`: nothing in it can close the element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * The tags for `head`: title, description, canonical link, Open Graph and X card. `url` is the page's canonical
 * address (none for the 404), `image` the share image's public path.
 */
export function headTags(head: PageHead, { url, image }: { url: string | null; image?: string }): string {
	const title = documentTitle(head.title);
	const meta = (key: 'name' | 'property', name: string, content: string) =>
		`<meta ${key}="${name}" content="${escapeAttribute(content)}" />`;
	const imageUrl = image ? new URL(image, SITE_URL).href : null;
	return [
		`<title>${escapeAttribute(title)}</title>`,
		meta('name', 'description', head.description),
		head.noindex ? meta('name', 'robots', 'noindex') : null,
		url ? `<link rel="canonical" href="${escapeAttribute(url)}" />` : null,
		meta('property', 'og:type', 'website'),
		meta('property', 'og:site_name', APP_NAME),
		meta('property', 'og:locale', 'en_US'),
		meta('property', 'og:title', title),
		meta('property', 'og:description', head.description),
		url ? meta('property', 'og:url', url) : null,
		...(imageUrl
			? [
					meta('property', 'og:image', imageUrl),
					meta('property', 'og:image:type', 'image/png'),
					meta('property', 'og:image:width', String(SHARE_IMAGE.width)),
					meta('property', 'og:image:height', String(SHARE_IMAGE.height)),
					meta('property', 'og:image:alt', SHARE_IMAGE.alt),
				]
			: []),
		meta('name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary'),
		meta('name', 'twitter:title', title),
		meta('name', 'twitter:description', head.description),
		...(imageUrl ? [meta('name', 'twitter:image', imageUrl), meta('name', 'twitter:image:alt', SHARE_IMAGE.alt)] : []),
		head.structuredData
			? `<script type="application/ld+json">${scriptJson({ '@context': 'https://schema.org', ...head.structuredData })}</script>`
			: null,
	]
		.filter((tag) => tag !== null)
		.join('\n\t\t');
}
