/**
 * Static file serving for production builds of the frontend micro-frontends.
 *
 * Serves pre-built Vite bundles for the frontend zones (web, docs) directly
 * from the same HTTP server that handles the API. Each zone maps a URL prefix
 * to its build directory and falls back to `index.html` for client-side
 * routing (SPA mode).
 *
 * ## Directory resolution
 *
 * In production, set the `STATIC_DIR` environment variable to the root of
 * the mounted volume containing the zone directories:
 *
 * ```
 * STATIC_DIR=/var/www
 * ├── web/            — contents of packages/web/dist
 * └── docs/           — contents of packages/docs/dist
 * ```
 *
 * When `STATIC_DIR` is not set (development), zone directories are resolved
 * relative to the monorepo layout (`packages/<zone>/dist`). Zones whose
 * directories don't exist are automatically skipped, so the server runs
 * cleanly in development without pre-built bundles.
 *
 * @module static
 */

import { resolve } from 'node:path';
import { env } from '@server/lib/env';
import { log as rootLog } from '@server/lib/logger';

// ---------------------------------------------------------------------------
// Module logger
// ---------------------------------------------------------------------------

const log = rootLog.child({ module: 'static' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A frontend zone mapping a URL prefix to a built asset directory. */
interface Zone {
	/** Human-readable name for logging. */
	name: string;
	/** URL path prefix (e.g. `"/docs"`). The root zone uses `"/"`. */
	basePath: string;
	/** Absolute path to the zone's built asset directory. */
	dir: string;
}

// ---------------------------------------------------------------------------
// Zone configuration
// ---------------------------------------------------------------------------

/**
 * Resolves the asset directory for a given zone package.
 *
 * - When `STATIC_DIR` is set, looks for `<STATIC_DIR>/<pkg>/` (the volume
 *   mount is expected to contain the dist contents directly).
 * - Otherwise, resolves to `packages/<pkg>/dist/` relative to this file's
 *   location in the monorepo (`packages/server/src/lib/` → three levels
 *   up reaches `packages/`).
 */
function resolveZoneDir(pkg: string): string {
	if (env.STATIC_DIR) {
		return resolve(env.STATIC_DIR, pkg);
	}
	return resolve(import.meta.dir, '..', '..', '..', pkg, 'dist');
}

/**
 * Frontend zones ordered by specificity — more-specific prefixes first,
 * catch-all root zone last. The first matching zone wins.
 */
const ZONES: Zone[] = [
	{ name: 'docs', basePath: '/docs', dir: resolveZoneDir('docs') },
	{ name: 'web', basePath: '/', dir: resolveZoneDir('web') }
];

/** Zone base paths whose `index.html` was verified at startup. */
const availableZones = new Set<string>();

// ---------------------------------------------------------------------------
// Cache headers
// ---------------------------------------------------------------------------

/**
 * Vite places all content-hashed assets under an `assets/` directory.
 * These filenames change on every build, so they are safe to cache
 * indefinitely.
 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** HTML entry points must always be revalidated. */
const NO_CACHE = 'no-cache';

/** Default cache for non-hashed static files (e.g. `favicon.ico`). */
const MODERATE_CACHE = 'public, max-age=3600';

/**
 * Returns the appropriate `Cache-Control` value for a given file path.
 */
function cacheControl(filePath: string): string {
	if (filePath.includes('/assets/')) return IMMUTABLE_CACHE;
	if (filePath.endsWith('.html')) return NO_CACHE;
	return MODERATE_CACHE;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Scans each zone's directory for an `index.html` and marks available
 * zones. Call once at startup before accepting requests.
 *
 * Zones without an `index.html` are silently skipped so the server can
 * run in development without pre-built frontend bundles.
 */
export async function initializeZones(): Promise<void> {
	for (const zone of ZONES) {
		const indexPath = resolve(zone.dir, 'index.html');
		const exists = await Bun.file(indexPath).exists();

		if (exists) {
			availableZones.add(zone.basePath);
			log.info({ zone: zone.name, dir: zone.dir }, 'static zone available');
		} else {
			log.debug({ zone: zone.name, dir: zone.dir }, 'static zone skipped (no index.html)');
		}
	}

	if (availableZones.isEmpty()) {
		log.info('no static zones available — frontend assets will not be served');
	} else {
		log.info(
			{ zones: availableZones.size, staticDir: env.STATIC_DIR ?? '(monorepo)' },
			'static file serving initialized'
		);
	}
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

/**
 * Attempts to serve a static file for the given request.
 *
 * Matches the request URL against the configured zones, resolves the
 * file path within the zone's asset directory, and returns a `Response`
 * with appropriate cache headers. When the requested path does not
 * correspond to a real file, the zone's `index.html` is returned for
 * client-side routing (SPA fallback).
 *
 * Returns `null` when no available zone matches — the caller should
 * continue its own fallback logic (e.g. 404).
 *
 * @param request - The incoming HTTP request.
 * @returns A static file `Response`, or `null` to pass through.
 */
export async function serveStaticFile(request: Request): Promise<Response | null> {
	if (availableZones.isEmpty()) return null;

	const { pathname } = new URL(request.url);

	// -----------------------------------------------------------------
	// Match the first available zone whose prefix fits the request path.
	// -----------------------------------------------------------------

	const zone = ZONES.find((z) => {
		if (!availableZones.has(z.basePath)) return false;
		// Root zone matches everything.
		if (z.basePath === '/') return true;
		// Prefixed zones must match exactly or with a trailing slash/path.
		return pathname === z.basePath || pathname.startsWith(`${z.basePath}/`);
	});

	if (!zone) return null;

	// -----------------------------------------------------------------
	// Resolve a file path within the zone's asset directory.
	// -----------------------------------------------------------------

	const relativePath = zone.basePath === '/' ? pathname : pathname.slice(zone.basePath.length) || '/';

	const filePath = resolve(zone.dir, `.${relativePath}`);

	// Guard against path-traversal attacks (e.g. `/../../../etc/passwd`).
	if (!filePath.startsWith(zone.dir)) {
		log.warn({ pathname, resolved: filePath, zone: zone.name }, 'path traversal attempt blocked');
		return null;
	}

	// -----------------------------------------------------------------
	// Serve the exact file if it exists on disk.
	// -----------------------------------------------------------------

	const file = Bun.file(filePath);

	if ((await file.exists()) && file.size > 0) {
		return new Response(file, {
			headers: { 'Cache-Control': cacheControl(filePath) }
		});
	}

	// -----------------------------------------------------------------
	// SPA fallback — serve the zone's index.html for client-side routing.
	// -----------------------------------------------------------------

	const indexFile = Bun.file(resolve(zone.dir, 'index.html'));

	return new Response(indexFile, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': NO_CACHE
		}
	});
}
