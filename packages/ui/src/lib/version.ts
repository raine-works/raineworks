/**
 * Which build of the app this page is, and noticing when there's a newer one.
 *
 * - `APP_VERSION` / `APP_COMMIT`: stamped by the zone's build (`YEAR.MONTH.N`,
 *   `@raineworks/tools/version`), shown on every page (`blocks/release-notes`).
 * - `useUpdateCheck`: the page knows the build it loaded with (its
 *   `<meta name="raineworks-build">`, stamped by the server). It asks which build
 *   the zone serves now (`GET /api/build`, through the shared client's
 *   `apiFetch`: it's outside the typed routes) every minute while the tab is
 *   in view, whenever it comes back into view, gets focus or comes back
 *   online, and at once when a live-update stream reconnects
 *   ({@link requestUpdateCheck}: a deploy restarts the server, which drops
 *   every stream). Once that differs, it says so, once, with a reload and
 *   what's new. Not in development, where there's no build to compare.
 *
 * @module lib/version
 */

import '@raineworks/tools/prototypes';
import { resolveZone } from '@raineworks/tools/zones';
import { apiFetch } from '@raineworks/ui/lib/api';
import { APP_NAME } from '@raineworks/ui/lib/brand';
import { readStored, removeStored, writeStored } from '@raineworks/ui/lib/browser-storage';
import { useEffect } from 'react';
import { toast } from 'sonner';

/** The build's version (`YEAR.MONTH.N`), or `dev` when nothing stamped it. */
export const APP_VERSION = typeof __RAINEWORKS_VERSION__ === 'string' ? __RAINEWORKS_VERSION__ : 'dev';
/** The build's commit, or `unknown` when nothing stamped it. */
export const APP_COMMIT = typeof __RAINEWORKS_COMMIT__ === 'string' ? __RAINEWORKS_COMMIT__ : 'unknown';

/** How often an open tab in view asks. */
const CHECK_EVERY_MS = 60_000;
/** Coming back to a tab, focusing it or coming back online checks again, but not more than this often. */
const MIN_GAP_MS = 60_000;
/** Set before reloading from "What's new", so the new page opens the notes. */
export const SHOW_NOTES_AFTER_RELOAD = 'raineworks.releaseNotes.showAfterReload';

const loadedBuild = () => document.querySelector<HTMLMetaElement>('meta[name="raineworks-build"]')?.content ?? null;

/** The mounted {@link useUpdateCheck}'s check, run past its minimum gap; `null` while none is mounted. */
let checkNow: (() => void) | null = null;

/**
 * Asks at once whether the app has been updated under this page, however recently it last asked: for what's seen a
 * likely deploy (a live-update stream that dropped and reconnected). Does nothing without a mounted {@link useUpdateCheck}.
 */
export function requestUpdateCheck(): void {
	checkNow?.();
}

/** Tells the person once the app has been updated under this page, offering to reload (and what's new). */
export function useUpdateCheck(onWhatsNew: () => void) {
	useEffect(() => {
		const build = loadedBuild();
		const zone = resolveZone(location.pathname)?.zone;
		if (!build || !zone) return;
		let told = false;
		let lastCheck = 0;
		const check = async (force = false) => {
			if (told || (!force && Date.now() - lastCheck < MIN_GAP_MS)) return;
			lastCheck = Date.now();
			const { data: response } = await apiFetch(`/api/build?zone=${zone}`, { cache: 'no-store' }).tryCatch();
			if (!response?.ok) return;
			const { data: current } = await (
				response.json() as Promise<{ build: string | null; version?: string }>
			).tryCatch();
			if (!current?.build || current.build === build || told) return;
			told = true;
			toast(`${APP_NAME} has been updated`, {
				description: current.version ? `Version ${current.version} is ready. Reload to use it.` : 'Reload to use it.',
				duration: Number.POSITIVE_INFINITY,
				action: { label: 'Reload', onClick: () => location.reload() },
				cancel: {
					label: 'What’s new',
					onClick: () => {
						// Refused, the page still reloads; the notes are a click away.
						writeStored(SHOW_NOTES_AFTER_RELOAD, '1', 'sessionStorage');
						location.reload();
					},
				},
			});
		};
		const inView = () => document.visibilityState === 'visible';
		const onVisible = () => {
			if (inView()) void check();
		};
		// A hidden tab doesn't ask on the clock: coming back into view asks. The clock isn't held to the gap, or a focus
		// between two ticks (or a tick a little late) would skip the next one, stretching a minute towards two.
		const timer = setInterval(() => {
			if (inView()) void check(true);
		}, CHECK_EVERY_MS);
		const forced = () => void check(true);
		checkNow = forced;
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onVisible);
		window.addEventListener('online', onVisible);
		// Reloaded from "What's new": show them (with storage refused, there's nothing to show).
		if (readStored(SHOW_NOTES_AFTER_RELOAD, 'sessionStorage')) {
			removeStored(SHOW_NOTES_AFTER_RELOAD, 'sessionStorage');
			onWhatsNew();
		}
		return () => {
			clearInterval(timer);
			if (checkNow === forced) checkNow = null;
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onVisible);
			window.removeEventListener('online', onVisible);
		};
	}, [onWhatsNew]);
}
