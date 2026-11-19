/**
 * Serves the web micro-frontends (`@raineworks/web-*`), one per zone (`@raineworks/tools/zones`). The first path
 * segment picks the zone; everything no other zone claims (including `/`) is the root zone's (`marketing`).
 *
 * - Compiled binary: assets embedded with `--asset=web` (`scripts/build.ts`), read from `Bun.embeddedFiles`
 *   (names `web/<zone>/<file>`).
 * - Otherwise: `WEB_DIST/<zone>/` when set, else each zone's `packages/web-<name>/dist`.
 *
 * Unknown paths without a file extension fall back to the zone's `index.html` so client-side routes deep-link.
 * Assets:
 *
 * - Sent precompressed when the client accepts it: the build writes `.br` / `.gz` siblings
 *   (`@raineworks/tools/build`), picked by `Accept-Encoding`.
 * - Content-hashed files (`chunk-x.js`, `favicon-x.svg`) are cached for a year, immutably.
 * - `index.html` is compressed on the fly and revalidated on every load against a strong ETag of the file, which
 *   also names the build (`<meta name="raineworks-build">`, `zoneBuild`) so an open page can tell when it's been
 *   replaced. Development reads the file each time and never caches it.
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

/** A zone's `index.html` and its ETag, read once outside development. */
interface IndexTemplate {
	html: string;
	etag: string | null;
}

/** By the build each is of. */
const templates = new WeakMap<Resolver, Promise<IndexTemplate | null>>();

async function readTemplate(resolve: Resolver, withEtag: boolean): Promise<IndexTemplate | null> {
	const file = resolve('index.html');
	if (!file) return null;
	const html = await file.text();
	const etag = withEtag ? new Bun.CryptoHasher('sha256').update(html).digest('base64url').slice(0, 27) : null;
	return { html, etag };
}

function indexTemplate(resolve: Resolver): Promise<IndexTemplate | null> {
	if (env.NODE_ENV === 'development') return readTemplate(resolve, false);
	let template = templates.get(resolve);
	if (!template) {
		template = readTemplate(resolve, true);
		templates.set(resolve, template);
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
	const template = await indexTemplate(resolve);
	// Its version and commit, as its build wrote them (`@raineworks/tools/build`).
	const { data: info } = await tryCatch(
		async () => (await resolve('build.json')?.json()) as { version?: string; commit?: string } | undefined,
	);
	return { build: template?.etag ?? null, version: info?.version ?? null, commit: info?.commit ?? null };
}

/** Whether `If-None-Match` names `etag` (weak comparison, as RFC 9110 has it for this header). */
function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
	if (!ifNoneMatch) return false;
	if (ifNoneMatch.trim() === '*') return true;
	return ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag);
}

async function serveIndex(resolve: Resolver, request: Request): Promise<Response | null> {
	const template = await indexTemplate(resolve);
	if (!template) return null;
	const encoding = negotiateEncoding(request.headers.get('accept-encoding'));
	const headers: Record<string, string> = {
		...getAssetHeaders('index.html', env.NODE_ENV === 'development'),
		Vary: 'Accept-Encoding',
	};
	if (template.etag) {
		// One tag per representation: the encodings differ byte for byte.
		const etag = `"${template.etag}${encoding ? `-${encoding}` : ''}"`;
		headers.ETag = etag;
		if (matchesEtag(request.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers });
	}
	const html = template.etag
		? template.html.replace('</head>', `<meta name="raineworks-build" content="${template.etag}" />\n</head>`)
		: template.html;
	if (!encoding) return new Response(html, { headers });
	return new Response(compressBytes(html, encoding), { headers: { ...headers, 'Content-Encoding': encoding } });
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

/** The zone page or asset for `request`, or `null` when its zone isn't built. */
export async function serveSpa(request: Request): Promise<Response | null> {
	const { zone, path: encoded } = resolveZone(new URL(request.url).pathname);
	const resolve = spaResolver(zone);
	if (!resolve) return null;

	const { data: path, error } = tryCatch(() => decodeURIComponent(encoded));
	if (error) return new Response('Bad Request', { status: 400 }); // malformed percent-encoding

	const asset = path && path !== 'index.html' ? resolve(path) : null;
	if (asset) return serveAsset(resolve, path, asset, request);
	if (/\.[a-z0-9]+$/i.test(path) && path !== 'index.html') return new Response('Not Found', { status: 404 });
	return serveIndex(resolve, request);
}
