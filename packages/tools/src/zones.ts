/**
 * Micro-frontend zones. Every web app is its own package, built with its
 * own `publicPath` and served by `@raineworks/server` under one origin, so they
 * share cookies and `localStorage` (the theme).
 *
 * The server routes a request to a zone by its first path segment. The root
 * (`/`) and anything no other zone claims belong to the `marketing` zone. Links between zones are full page loads (`zoneHref`), not
 * client-side navigation.
 *
 * @module zones
 */

import { tryCatch } from '@raineworks/tools/prototypes';

/** Every zone: where it is served, its package and its title. A new zone is registered here. */
export const ZONES = {
	marketing: { basepath: '/', package: 'web-marketing', title: 'raineworks' },
} as const;

/** A key of {@link ZONES}. */
export type ZoneId = keyof typeof ZONES;

/** Every {@link ZoneId}, in the order {@link ZONES} lists them. */
export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

/** The zone served at `/`, which gets every path no other zone claims. */
export const ROOT_ZONE: ZoneId = 'marketing';

/** Whether `value` names a zone: check anything a browser reported before handing it to `zoneHref`. */
export const isZoneId = (value: unknown): value is ZoneId => typeof value === 'string' && Object.hasOwn(ZONES, value);

/** Whether `zone` is mounted at the root (`/`) rather than under a path segment of its own. */
const isRoot = (zone: ZoneId): boolean => ZONES[zone].basepath === '/';

/** Bundler `publicPath` for a zone: its basepath with a trailing slash (`/` for the root zone). */
export const zonePublicPath = (zone: ZoneId): string => (isRoot(zone) ? '/' : `${ZONES[zone].basepath}/`);

/** Same-origin URL inside a zone, e.g. `zoneHref('marketing', '/projects')` → `/projects`. */
export function zoneHref(zone: ZoneId, path = '/'): string {
	const rest = path.startsWith('/') ? path : `/${path}`;
	if (isRoot(zone)) return rest;
	return rest === '/' ? ZONES[zone].basepath : `${ZONES[zone].basepath}${rest}`;
}

/**
 * Splits a request path into its zone and the path inside it (no leading slash). A zone mounted under a segment of
 * its own wins its paths; everything else is the root zone's.
 */
export function resolveZone(pathname: string): { zone: ZoneId; path: string } {
	const trimmed = pathname.replace(/^\/+/, '');
	const [first = '', ...rest] = trimmed.split('/');
	for (const zone of ZONE_IDS) {
		if (!isRoot(zone) && ZONES[zone].basepath === `/${first}`) return { zone, path: rest.join('/') };
	}
	return { zone: ROOT_ZONE, path: trimmed };
}

/** Where relative redirects are resolved to check them: any origin will do, as long as it's the one compared. */
const REDIRECT_BASE = 'https://raineworks.invalid';

/**
 * Only same-origin, absolute paths are honoured as redirects, so a crafted
 * `?redirect=` can't bounce a visitor elsewhere. Control characters are
 * refused outright (browsers drop tabs and newlines, so `/\t/evil.example`
 * would read as `//evil.example`), and what's left must resolve to this
 * origin the way a browser would resolve it. Returns the path as resolved.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
	if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
	// Control characters are what's being refused.
	if (/[\u0000-\u001f\u007f]/.test(value)) return null;
	const { data: url } = tryCatch(() => new URL(value, REDIRECT_BASE));
	if (!url) return null;
	if (url.origin !== REDIRECT_BASE) return null;
	return `${url.pathname}${url.search}${url.hash}`;
}
