/**
 * Light / dark / system colour scheme, shared by every zone through
 * `localStorage` (`lib/browser-storage`) and applied as the `dark` class on
 * `<html>`. Where storage is refused, a choice still applies, for this page
 * only: the next load is the system's again.
 *
 * @module hooks/use-theme
 */

import { readStored, writeStored } from '@raineworks/ui/lib/browser-storage';
import { useSyncExternalStore } from 'react';

/** The choices: a scheme, or whatever the system prefers. */
export const THEMES = ['light', 'dark', 'system'] as const;
/** One of {@link THEMES}. */
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'raineworks:theme';
const listeners = new Set<() => void>();
const media = () => (typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)'));

/** A choice that storage refused to keep: it holds for this page, never for another zone or the next load. */
let unstored: Theme | null = null;

function readTheme(): Theme {
	const stored = readStored(STORAGE_KEY);
	return THEMES.includes(stored as Theme) ? (stored as Theme) : (unstored ?? 'system');
}

const resolve = (theme: Theme): 'light' | 'dark' =>
	theme === 'system' ? (media()?.matches ? 'dark' : 'light') : theme;

/** Applies the stored theme to `<html>`. Call once before the first render to avoid a flash. */
export function applyTheme(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', resolve(readTheme()) === 'dark');
}

/** Stores `theme` (for every zone; for this page alone where storage is refused), applies it and tells every `useTheme` caller. */
export function setTheme(theme: Theme): void {
	writeStored(STORAGE_KEY, theme);
	unstored = readStored(STORAGE_KEY) === theme ? null : theme;
	applyTheme();
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	const onSystemChange = () => {
		applyTheme();
		listener();
	};
	media()?.addEventListener('change', onSystemChange);
	return () => {
		listeners.delete(listener);
		media()?.removeEventListener('change', onSystemChange);
	};
}

/**
 * The theme and what it resolves to, as one value: an OS scheme change leaves the theme `system` but changes what it
 * resolves to, and React re-renders only when the snapshot does.
 */
const readSnapshot = () => {
	const theme = readTheme();
	return `${theme}:${resolve(theme)}` as const;
};

/** The chosen theme, the scheme it resolves to now (`system` follows the OS, live), and {@link setTheme}. */
export function useTheme() {
	const [theme, resolvedTheme] = useSyncExternalStore(subscribe, readSnapshot, () => 'system:light' as const).split(
		':',
	) as [Theme, 'light' | 'dark'];
	return { theme, resolvedTheme, setTheme };
}
