/**
 * HTTP helpers the server and the frontend build share, so they agree: MIME types, the content codings served (and
 * the precompressed siblings the build writes), and `Cache-Control` for build outputs.
 *
 * @module http
 */

import '@raineworks/tools/prototypes';
import { brotliCompressSync, constants as zlib } from 'node:zlib';

/**
 * Returns standard MIME content type based on the file extension.
 *
 * @param filePath - Path or filename of the asset.
 * @returns Standard MIME content type with charset if applicable.
 */
export function getMimeType(filePath: string): string {
	const [path = ''] = filePath.split('?');
	const clean = path.toLowerCase();
	if (clean.endsWith('.html')) return 'text/html; charset=utf-8';
	if (clean.endsWith('.js') || clean.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
	if (clean.endsWith('.css')) return 'text/css; charset=utf-8';
	if (clean.endsWith('.json')) return 'application/json; charset=utf-8';
	if (clean.endsWith('.svg')) return 'image/svg+xml';
	if (clean.endsWith('.png')) return 'image/png';
	if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
	if (clean.endsWith('.webp')) return 'image/webp';
	if (clean.endsWith('.ico')) return 'image/x-icon';
	if (clean.endsWith('.woff2')) return 'font/woff2';
	if (clean.endsWith('.woff')) return 'font/woff';
	if (clean.endsWith('.map')) return 'application/json';
	if (clean.endsWith('.txt')) return 'text/plain; charset=utf-8';
	if (clean.endsWith('.xml')) return 'application/xml; charset=utf-8';
	return 'application/octet-stream';
}

// ---- Compression ----

/** Content codings raineworks serves, best first. */
export const CONTENT_ENCODINGS = ['br', 'gzip'] as const;
/** One of {@link CONTENT_ENCODINGS}. */
export type ContentEncoding = (typeof CONTENT_ENCODINGS)[number];

/** Suffix of the precompressed sibling the frontend build writes next to an output (`chunk-x.js.br`). */
export const ENCODING_SUFFIX: Record<ContentEncoding, string> = { br: '.br', gzip: '.gz' };

/** Text outputs worth compressing. Images and fonts are already compressed. */
export const isCompressible = (filePath: string): boolean => /\.(m?js|css|html|svg|json|txt|xml)$/i.test(filePath);

/**
 * The best coding the client accepts (`Accept-Encoding`): the highest q-value, `br` over `gzip` on a tie, and
 * `null` for identity (no header, nothing acceptable, or only codings raineworks doesn't produce).
 */
export function negotiateEncoding(acceptEncoding: string | null | undefined): ContentEncoding | null {
	if (!acceptEncoding) return null;
	const weights = new Map<string, number>();
	for (const part of acceptEncoding.split(',')) {
		const [raw = '', ...params] = part.toLowerCase().split(';');
		const token = raw.trim();
		if (!token) continue;
		const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
		const weight = q ? Number(q.slice(2)) : 1;
		weights.set(token, Number.isFinite(weight) ? weight : 0);
	}
	let best: { encoding: ContentEncoding; q: number } | null = null;
	for (const encoding of CONTENT_ENCODINGS) {
		const q = weights.get(encoding) ?? weights.get('*') ?? 0;
		if (q > 0 && (!best || q > best.q)) best = { encoding, q };
	}
	return best?.encoding ?? null;
}

/**
 * Compresses `data` with `encoding`. `level` trades CPU for size: `max` is for build time (brotli 11, gzip 9),
 * `fast` for responses compressed per request (brotli 4, gzip 6).
 */
export function compressBytes(
	data: Uint8Array<ArrayBuffer> | string,
	encoding: ContentEncoding,
	level: 'max' | 'fast' = 'fast',
): Uint8Array<ArrayBuffer> {
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
	if (encoding === 'gzip') return Bun.gzipSync(bytes, { level: level === 'max' ? 9 : 6 });
	return brotliCompressSync(bytes, {
		params: {
			[zlib.BROTLI_PARAM_QUALITY]: level === 'max' ? zlib.BROTLI_MAX_QUALITY : 4,
			[zlib.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength,
			[zlib.BROTLI_PARAM_MODE]: zlib.BROTLI_MODE_TEXT,
		},
	});
}

// ---- Caching ----

/**
 * Whether a build output's name carries its content hash: Bun names chunks and assets `[name]-[hash].[ext]`
 * (`chunk-jxjybjk2.js`, `raineworks-mark-c5ht1nvs.png`), the hash being 8 characters of its base-32 alphabet (digits and
 * lowercase letters but `i`, `l`, `o`, `u`). Only the HTML entry keeps its own name. Matching the alphabet keeps
 * `site-manifest.json` out; a hand-named file ending in `-` and 8 such characters (`x-feedback.json`) would still be
 * cached for a year, so don't name one that way.
 */
export const isContentHashed = (filePath: string): boolean =>
	/-[0-9a-hjkmnp-tv-z]{8}\.[a-z0-9]+(\.map)?$/.test(filePath);

/** `Cache-Control` for an HTML document: revalidated on every load, never kept by shared caches (it holds a nonce). */
export const HTML_CACHE_CONTROL = 'private, max-age=0, must-revalidate';
/** `Cache-Control` for HTML in development: never stored, so a rebuild shows on the next load. */
export const DEV_CACHE_CONTROL = 'no-cache, no-store, must-revalidate';
/** `Cache-Control` for a content-hashed file: a year, never revalidated (a change is a new name). */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * `Content-Type` and `Cache-Control` for a build output. Content-hashed files are cached for a year, immutably
 * (in development too: a change is a new name); HTML is revalidated (development: never stored); anything else
 * briefly. Security headers are the server's (`secureHeaders` in `@raineworks/server/app`), not set here.
 *
 * @param filePath - The path or filename of the asset.
 * @param isDev - Whether live reload development mode is active.
 */
export function getAssetHeaders(filePath: string, isDev = false): Record<string, string> {
	const mimeType = getMimeType(filePath);
	let cacheControl: string;
	if (mimeType.startsWith('text/html')) cacheControl = isDev ? DEV_CACHE_CONTROL : HTML_CACHE_CONTROL;
	else if (isContentHashed(filePath)) cacheControl = IMMUTABLE_CACHE_CONTROL;
	else cacheControl = isDev ? 'no-cache' : 'public, max-age=3600';
	return { 'Content-Type': mimeType, 'Cache-Control': cacheControl };
}

/**
 * Determines whether the current process is executing within a self-contained Bun standalone binary.
 * Standalone binaries embed assets in Bun's virtual filesystem (`/$bunfs` or `Bun.embeddedFiles`).
 *
 * @returns `true` if running as a compiled standalone executable, `false` otherwise.
 */
export function isStandaloneMode(): boolean {
	return !(Bun.embeddedFiles ?? []).isEmpty() || import.meta.dir.startsWith('/$bunfs');
}
