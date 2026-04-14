/**
 * Theme provider with dark / light / system support.
 *
 * Persists the user's preference in `localStorage` and applies the
 * corresponding class (`dark` or nothing) to the `<html>` element so
 * Tailwind's `dark:` variant works out of the box.
 *
 * When `"system"` is selected the provider listens to the
 * `prefers-color-scheme` media query and switches automatically.
 *
 * @module providers/theme
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'dark' | 'light' | 'system';

export interface ThemeProviderProps {
	children: React.ReactNode;
	/** Default theme when nothing is stored in localStorage. */
	defaultTheme?: Theme;
	/** localStorage key used to persist the selection. */
	storageKey?: string;
}

export interface ThemeProviderState {
	/** The raw preference (`"dark"` | `"light"` | `"system"`). */
	theme: Theme;
	/** The resolved appearance after evaluating `"system"`. */
	resolvedTheme: 'dark' | 'light';
	/** Update the theme preference. */
	setTheme: (theme: Theme) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY_DEFAULT = 'rainestack-theme';

/** Reads the OS preference via `matchMedia`. */
function getSystemTheme(): 'dark' | 'light' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the resolved theme class to `<html>`. */
function applyTheme(resolved: 'dark' | 'light') {
	const root = document.documentElement;
	root.classList.remove('light', 'dark');
	root.classList.add(resolved);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function ThemeProvider({ children, defaultTheme = 'system', storageKey = STORAGE_KEY_DEFAULT }: ThemeProviderProps) {
	const [theme, setThemeRaw] = useState<Theme>(() => {
		if (typeof window === 'undefined') return defaultTheme;
		return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
	});

	const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

	// Apply the class immediately on mount and whenever the theme changes.
	useEffect(() => {
		applyTheme(resolvedTheme);
	}, [resolvedTheme]);

	// Listen for OS-level changes when "system" is selected.
	useEffect(() => {
		if (theme !== 'system') return;

		const mql = window.matchMedia('(prefers-color-scheme: dark)');

		const handler = (e: MediaQueryListEvent) => {
			applyTheme(e.matches ? 'dark' : 'light');
		};

		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}, [theme]);

	const setTheme = useCallback(
		(next: Theme) => {
			localStorage.setItem(storageKey, next);
			setThemeRaw(next);
		},
		[storageKey]
	);

	const value = useMemo<ThemeProviderState>(
		() => ({
			theme,
			resolvedTheme,
			setTheme
		}),
		[theme, resolvedTheme, setTheme]
	);

	return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current theme state and setter.
 *
 * Must be used inside a `<ThemeProvider>`.
 */
function useTheme(): ThemeProviderState {
	const context = useContext(ThemeProviderContext);
	if (!context) {
		throw new Error('useTheme must be used within a <ThemeProvider>');
	}
	return context;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ThemeProvider, useTheme };
