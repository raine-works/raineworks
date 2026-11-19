/**
 * Lazily loaded pieces that survive a release. Every chunk is content-hashed, so once a new build is deployed the
 * chunks an open page was built with are gone: the next `import()` of one fails. A page that has never loaded it
 * can't, so it reloads (once) and gets the new build instead of a broken popover or chart.
 *
 * - `lazyWithReload(load)`: `React.lazy`, reloading the page when its chunk is gone. Use it for every lazy piece
 *   that isn't a route (routes use TanStack's `lazyRouteComponent`, which does the same).
 * - `reloadForStaleChunk(error)`: the reload itself, for anything else that imports a chunk.
 * - `isChunkLoadError(error)`: whether an error is a chunk that failed to load (`blocks/query-state` offers Reload).
 *
 * The reload is guarded through `sessionStorage` (`lib/browser-storage`): once per page load, and never again within
 * a minute of the last one, so a chunk that's missing for another reason can't reload the page over and over. With
 * storage refused there's no guard, so there's no reload either: the failure shows, with its Reload button.
 *
 * @module lib/lazy
 */

import '@raineworks/tools/prototypes';
import { readStored, writeStored } from '@raineworks/ui/lib/browser-storage';
import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

/** How each browser words a dynamic `import()` that failed (Chromium, Firefox, Safari). */
const CHUNK_FAILURES = [
	'Failed to fetch dynamically imported module',
	'error loading dynamically imported module',
	'Importing a module script failed',
];

/** Where the time of the last reload for a missing chunk is kept, for this tab. */
export const CHUNK_RELOAD_KEY = 'raineworks.chunkReload';
/** A chunk still missing this soon after reloading for one isn't fixed by reloading again. */
export const CHUNK_RELOAD_GAP_MS = 60_000;

/** Whether `error` is a chunk that failed to load: after a release, most likely one that's gone. */
export function isChunkLoadError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const { message } = error;
	return error.name === 'ChunkLoadError' || CHUNK_FAILURES.some((start) => message.startsWith(start));
}

/**
 * Claims the one reload this page may make for a missing chunk: `true` (and remembered for this tab) unless one was
 * made in the last {@link CHUNK_RELOAD_GAP_MS}, or storage is refused (nothing could stop the next page reloading too).
 */
export function claimChunkReload(now: number = Date.now()): boolean {
	const last = Number(readStored(CHUNK_RELOAD_KEY, 'sessionStorage'));
	if (last && now - last < CHUNK_RELOAD_GAP_MS) return false;
	const stamp = String(now);
	writeStored(CHUNK_RELOAD_KEY, stamp, 'sessionStorage');
	return readStored(CHUNK_RELOAD_KEY, 'sessionStorage') === stamp;
}

/** Reloads the page when `error` is a missing chunk and the guard allows it. Returns whether it's reloading. */
export function reloadForStaleChunk(error: unknown): boolean {
	if (!isChunkLoadError(error) || !claimChunkReload()) return false;
	location.reload();
	return true;
}

/**
 * `React.lazy(load)`, reloading the page (once, {@link claimChunkReload}) when the chunk is gone after a release.
 * Otherwise the failure is thrown to the nearest error boundary, as with `lazy`.
 *
 * ```tsx
 * const Calendar = lazyWithReload(async () => ({ default: (await import('@raineworks/ui/components/calendar')).Calendar }));
 * ```
 *
 * `T` is any component, whatever its props (`ComponentType<any>`, as `React.lazy` has it).
 */
export function lazyWithReload<T extends ComponentType<any>>(
	load: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
	return lazy(async () => {
		const { data, error } = await load().tryCatch();
		if (error === null) return data;
		// The page is going away: never settle, so nothing flashes an error first.
		if (reloadForStaleChunk(error)) return new Promise<never>(() => {});
		throw error;
	});
}
