/**
 * Serves the web micro-frontends (`@raineworks/web-*`), one per zone (`@raineworks/tools/zones`). The first path
 * segment picks the zone; everything no other zone claims (including `/`) is the root zone's (`marketing`).
 *
 * - Compiled binary: assets embedded with `--asset=web` (`scripts/build.ts`), read from `Bun.embeddedFiles`
 *   (names `web/<zone>/<file>`).
 * - Otherwise: `WEB_DIST/<zone>/` when set, else each zone's `packages/web-<name>/dist`.
 *
 * A path without a file extension is a page: the zone's prerendered one for it (`<path>/index.html`,
 * `@raineworks/tools/build`) when there is one, else its `404.html` with a 404 status, else (a zone that doesn't
 * prerender) its `index.html`, so client-side routes deep-link. A page that's off (`hidden`: the articles without an
 * X API token) is that 404 too. A `shell` (`PageShell`) gives the pages under a prerendered one the same file, for
 * routes whose pages the build can't list (a project's documentation pages come from its repository). Assets:
 *
 * - Sent precompressed when the client accepts it: the build writes `.br` / `.gz` siblings
 *   (`@raineworks/tools/build`), picked by `Accept-Encoding`.
 * - Content-hashed files (`chunk-x.js`, `favicon-x.svg`) are cached for a year, immutably.
 * - Pages are compressed on the fly and revalidated on every load against a strong ETag of what's sent. Each is
 *   stamped with the zone's build (`<meta name="raineworks-build">`, `zoneBuild`: its `index.html`'s hash) so an
 *   open page can tell when it's been replaced. Development reads them each time and never caches them.
 *
 * @module lib/spa
 */

import { existsSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

import { env } from '@raineworks/server/lib/env';
import {
	compressBytes,
	type ContentEncoding,
	ENCODING_SUFFIX,
	getAssetHeaders,
	isCompressible,
	negotiateEncoding,
} from '@raineworks/tools/http';
import { tryCatch } from '@raineworks/tools/prototypes';
import { resolveZone, ZONE_IDS, type ZoneId, ZONES } from '@raineworks/tools/zones';

type Resolver = (path: string) => Blob | null;

function embeddedResolvers(): Map<ZoneId, Resolver> {
	const files = (Bun.embeddedFiles ?? []) as Array<Blob & { name?: string }>;
	const byZone = new Map<ZoneId, Map<string, Blob>>();
	for (const file of files) {
		const name = file.name ?? '';
		const index = name.indexOf('web/');
		if (index === -1) continue;
		const [zone, ...rest] = name.slice(index + 'web/'.length).split('/');
		if (!ZONE_IDS.includes(zone as ZoneId)) continue;
		const assets = byZone.get(zone as ZoneId) ?? new Map<string, Blob>();
		assets.set(rest.join('/'), file);
		byZone.set(zone as ZoneId, assets);
	}
	return new Map([...byZone].map(([zone, assets]) => [zone, (path: string) => assets.get(path) ?? null]));
}

/** Files under `root` only: a sibling directory sharing its prefix (`dist-old/`) is outside it too. */
export function filesystemResolver(root: string): Resolver | null {
	const base = normalize(root).replace(/[\\/]+$/, '');
	if (!existsSync(join(base, 'index.html'))) return null;
	return (path) => {
		const full = normalize(join(base, path));
		if (!full.startsWith(base + sep)) return null; // path traversal
		return existsSync(full) && statSync(full).isFile() ? Bun.file(full) : null;
	};
}

const zoneRoot = (zone: ZoneId) =>
	env.WEB_DIST ? join(env.WEB_DIST, zone) : join(import.meta.dir, `../../../${ZONES[zone].package}/dist`);

let embedded: Map<ZoneId, Resolver> | undefined;
/** By the directory each is of: a zone served from somewhere else (`WEB_DIST` changed) is read afresh. */
const resolvers = new Map<string, Resolver | null>();

/**
 * `null` when the zone has no build (e.g. tests). Filesystem misses aren't cached in development, so a zone built
 * after the server started is picked up.
 */
export function spaResolver(zone: ZoneId): Resolver | null {
	embedded ??= embeddedResolvers();
	const fromBinary = embedded.get(zone);
	if (fromBinary) return fromBinary;
	const root = zoneRoot(zone);
	const cached = resolvers.get(root);
	if (cached) return cached;
	const resolver = filesystemResolver(root);
	if (resolver || env.NODE_ENV !== 'development') resolvers.set(root, resolver);
	return resolver;
}

/** A page as it's sent, and its ETag; read once outside development. */
interface PageTemplate {
	html: string;
	etag: string | null;
}

const hash = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('base64url').slice(0, 27);

/** The build a zone's files are: its `index.html`'s hash, which changes whenever any of them does. */
async function buildOf(resolve: Resolver): Promise<string | null> {
	const index = resolve('index.html');
	return index ? hash(await index.text()) : null;
}

/** By the build each is of, then by file. */
const templates = new WeakMap<Resolver, Map<string, Promise<PageTemplate | null>>>();

async function readTemplate(resolve: Resolver, file: string, withEtag: boolean): Promise<PageTemplate | null> {
	const page = resolve(file);
	if (!page) return null;
	const raw = await page.text();
	if (!withEtag) return { html: raw, etag: null };
	const build = await buildOf(resolve);
	const html = build ? raw.replace('</head>', `<meta name="raineworks-build" content="${build}" />\n</head>`) : raw;
	return { html, etag: hash(html) };
}

function pageTemplate(resolve: Resolver, file: string): Promise<PageTemplate | null> {
	if (env.NODE_ENV === 'development') return readTemplate(resolve, file, false);
	const byFile = templates.get(resolve) ?? new Map<string, Promise<PageTemplate | null>>();
	templates.set(resolve, byFile);
	let template = byFile.get(file);
	if (!template) {
		template = readTemplate(resolve, file, true);
		byFile.set(file, template);
	}
	return template;
}

/**
 * The build a zone is serving: its `index.html`'s hash, which changes whenever the zone does (its assets are named by
 * their content). Pages carry the one they loaded with (`<meta name="raineworks-build">`) and ask for this one
 * (`GET /api/build`) to see when the site has been updated under them. `null` in development, where it changes all the
 * time.
 */
export async function zoneBuild(
	zone: ZoneId,
): Promise<{ build: string | null; version: string | null; commit: string | null }> {
	const resolve = env.NODE_ENV === 'development' ? null : spaResolver(zone);
	if (!resolve) return { build: null, version: null, commit: null };
	// Its version and commit, as its build wrote them (`@raineworks/tools/build`).
	const { data: info } = await tryCatch(
		async () => (await resolve('build.json')?.json()) as { version?: string; commit?: string } | undefined,
	);
	return { build: await buildOf(resolve), version: info?.version ?? null, commit: info?.commit ?? null };
}

/** Whether `If-None-Match` names `etag` (weak comparison, as RFC 9110 has it for this header). */
function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
	if (!ifNoneMatch) return false;
	if (ifNoneMatch.trim() === '*') return true;
	return ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag);
}

/**
 * Pages the build can't list, served as a prerendered page of their own: a route (no leading or trailing slash) matching
 * `match` gets `file` (`$1`… from the match) when the zone has it, instead of the 404. The page hydrates as the route it
 * is, so what's prerendered must be what that route shows before its data arrives.
 */
export interface PageShell {
	match: RegExp;
	file: string;
}

/** The page file for `path` inside a zone, and its status: a `hidden` page is the 404. */
function pageFor(
	resolve: Resolver,
	path: string,
	hidden: readonly string[],
	shells: readonly PageShell[],
): { file: string; status: 200 | 404 } {
	const route = path.replace(/^\/+|\/+$/g, '');
	const prerendered = route ? `${route}/index.html` : 'index.html';
	if (!hidden.includes(`/${route}`) && resolve(prerendered)) return { file: prerendered, status: 200 };
	if (!hidden.includes(`/${route}`)) {
		for (const shell of shells) {
			if (!shell.match.test(route)) continue;
			const file = route.replace(shell.match, shell.file);
			if (resolve(file)) return { file, status: 200 };
		}
	}
	if (resolve('404.html')) return { file: '404.html', status: 404 };
	return { file: 'index.html', status: 200 };
}

async function servePage(
	resolve: Resolver,
	path: string,
	request: Request,
	hidden: readonly string[],
	shells: readonly PageShell[],
): Promise<Response | null> {
	const { file, status } = pageFor(resolve, path, hidden, shells);
	const template = await pageTemplate(resolve, file);
	if (!template) return null;
	const encoding = negotiateEncoding(request.headers.get('accept-encoding'));
	const headers: Record<string, string> = {
		...getAssetHeaders('index.html', env.NODE_ENV === 'development'),
		Vary: 'Accept-Encoding',
	};
	if (template.etag && status === 200) {
		// One tag per representation: the encodings differ byte for byte.
		const etag = `"${template.etag}${encoding ? `-${encoding}` : ''}"`;
		headers.ETag = etag;
		if (matchesEtag(request.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers });
	}
	if (!encoding) return new Response(template.html, { status, headers });
	return new Response(compressBytes(template.html, encoding), {
		status,
		headers: { ...headers, 'Content-Encoding': encoding },
	});
}

function serveAsset(resolve: Resolver, path: string, asset: Blob, request: Request): Response {
	const headers = getAssetHeaders(path, env.NODE_ENV === 'development');
	if (!isCompressible(path)) return new Response(asset, { headers });
	headers.Vary = 'Accept-Encoding';
	const encoding: ContentEncoding | null = negotiateEncoding(request.headers.get('accept-encoding'));
	const variant = encoding ? resolve(`${path}${ENCODING_SUFFIX[encoding]}`) : null;
	if (!encoding || !variant) return new Response(asset, { headers });
	return new Response(variant, { headers: { ...headers, 'Content-Encoding': encoding } });
}

/**
 * The zone page or asset for `request`, or `null` when its zone isn't built. `hidden` pages (paths inside their zone,
 * `/articles`) are served as its 404: pages that are off; `shells` are described at {@link PageShell}.
 */
export async function serveSpa(
	request: Request,
	hidden: readonly string[] = [],
	shells: readonly PageShell[] = [],
): Promise<Response | null> {
	const { zone, path: encoded } = resolveZone(new URL(request.url).pathname);
	const resolve = spaResolver(zone);
	if (!resolve) return null;

	const { data: path, error } = tryCatch(() => decodeURIComponent(encoded));
	if (error) return new Response('Bad Request', { status: 400 }); // malformed percent-encoding

	// Pages are served at their paths, never by their file names.
	const isPage = (name: string) => name.endsWith('.html');
	const asset = path && !isPage(path) ? resolve(path) : null;
	if (asset) return serveAsset(resolve, path, asset, request);
	if (/\.[a-z0-9]+$/i.test(path) && !isPage(path)) return new Response('Not Found', { status: 404 });
	return servePage(resolve, path === 'index.html' ? '' : path, request, hidden, shells);
}
