/**
 * The browser's storage (`localStorage` for what's remembered on this device: the theme, the sidebar, what's new
 * seen; `sessionStorage` for this tab), never throwing. Storage can be refused outright: with site data blocked, even
 * reaching `localStorage` (`typeof` included) throws a `SecurityError`, and outside a browser there's none. A read
 * then gets `null`, as if nothing were stored, and a write is dropped (forgotten on the next load). Go through these,
 * never the storage objects themselves.
 *
 * @module lib/browser-storage
 */

import { tryCatch } from '@raineworks/tools/prototypes';

type Area = 'localStorage' | 'sessionStorage';

/** What's stored under `key`, or `null` when nothing is or storage is refused. */
export function readStored(key: string, area: Area = 'localStorage'): string | null {
	return tryCatch(() => globalThis[area].getItem(key)).data ?? null;
}

/** Stores `value` under `key`, if storage is allowed (and has room). */
export function writeStored(key: string, value: string, area: Area = 'localStorage'): void {
	tryCatch(() => globalThis[area].setItem(key, value));
}

/** Forgets what's stored under `key`, if storage is allowed. */
export function removeStored(key: string, area: Area = 'localStorage'): void {
	tryCatch(() => globalThis[area].removeItem(key));
}
