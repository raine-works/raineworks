/**
 * Renders a zone's pages at build time (`prerender` in `@raineworks/tools/build`): every route without parameters,
 * each page a route with parameters lists (`staticData.pages`), and the page for paths nothing matches (a 404), each with its head (`staticData.head`, `lib/head`) and
 * the theme script, so a page shows (and unfurls) before its script runs. `mountZone` hydrates what this renders.
 *
 * ```tsx
 * // packages/web-<zone>/src/prerender.tsx
 * export const prerender = prerenderZone(router);
 * ```
 *
 * @module app/prerender
 */

import '@raineworks/tools/prototypes';
import type { PrerenderedPage, PrerenderModule } from '@raineworks/tools/build';
import { ZoneRoot } from '@raineworks/ui/app/root';
import { THEME_SCRIPT } from '@raineworks/ui/hooks/use-theme';
import { SITE_DESCRIPTION, SITE_URL } from '@raineworks/ui/lib/brand';
import { headTags, interpolatePath, type PageHead, SHARE_IMAGE } from '@raineworks/ui/lib/head';
import { type AnyRoute, type AnyRouter, createMemoryHistory } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

/** A path no route has, rendered as the zone's 404 page. */
const NOT_FOUND_PATH = '/__not-found__';

/** The 404's head: the zone's not-found page says the rest. */
const NOT_FOUND_HEAD: PageHead = { title: 'Page not found', description: SITE_DESCRIPTION, noindex: true };

/** Renders `path` with `router`, which is left there; `pageHead` for a page of a route with parameters. */
async function renderPath(
	router: AnyRouter,
	path: string,
	image: string | undefined,
	pageHead?: PageHead,
): Promise<PrerenderedPage> {
	router.update({ ...router.options, history: createMemoryHistory({ initialEntries: [path] }) });
	await router.load();
	const markup = renderToString(<ZoneRoot router={router} />);
	const found = path !== NOT_FOUND_PATH;
	const head = found ? (pageHead ?? router.state.matches.at(-1)?.staticData.head) : NOT_FOUND_HEAD;
	if (!head) throw new Error(`The route at ${path} has no staticData.head: give it a title and description.`);
	const url = found ? new URL(`${router.options.basepath?.replace(/\/$/, '') ?? ''}${path}`, SITE_URL).href : null;
	return {
		path,
		status: found ? 200 : 404,
		head: `${headTags(head, { url, image })}\n\t\t<script>${THEME_SCRIPT}</script>`,
		markup,
		...(head.unlisted && { unlisted: true }),
	};
}

/** The zone's `prerender` (`PrerenderModule`): every page `router` has, then its 404. */
export function prerenderZone(router: AnyRouter): PrerenderModule['prerender'] {
	return async ({ assets }) => {
		const image = assets[SHARE_IMAGE.file];
		const pages: PrerenderedPage[] = [];
		for (const [path, route] of Object.entries(router.routesByPath as Record<string, AnyRoute>)) {
			if (!path.includes('$')) {
				pages.push(await renderPath(router, path, image));
				continue;
			}
			for (const page of route.options.staticData?.pages ?? [])
				pages.push(await renderPath(router, interpolatePath(path, page.params), image, page.head));
		}
		pages.push(await renderPath(router, NOT_FOUND_PATH, image));
		return pages;
	};
}
