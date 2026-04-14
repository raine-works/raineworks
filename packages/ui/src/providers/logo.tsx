/**
 * Logo provider — centralised brand logo management.
 *
 * Supplies up to three logo variants — **icon**, **full** (icon + wordmark),
 * and **wordmark** (text only). Each variant accepts either a single
 * `ReactNode` (theme-agnostic) or a `{ light, dark }` pair for logos that
 * need separate renditions per colour mode.
 *
 * The {@link useLogo} hook resolves themed variants against the active
 * colour mode (via {@link useTheme}) and passes theme-agnostic nodes
 * through unchanged.
 *
 * ## Usage
 *
 * Mount `<LogoProvider>` inside `<ThemeProvider>` (it reads `useTheme`):
 *
 * ```tsx
 * <ThemeProvider>
 *   <LogoProvider logos={{
 *     icon: <BrandIcon className="size-full" />,
 *     full: { light: <FullLight />, dark: <FullDark /> },
 *   }}>
 *     <App />
 *   </LogoProvider>
 * </ThemeProvider>
 * ```
 *
 * Then consume from anywhere in the tree:
 *
 * ```tsx
 * const { icon, full, wordmark } = useLogo();
 * return <header>{icon}</header>;
 * ```
 *
 * @module providers/logo
 */

import { useTheme } from '@ui/providers/theme';
import { createContext, useContext, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A light / dark pair for a themed logo variant. */
interface ThemedLogoVariant {
	/** Rendered in light mode (`.light` or system-light). */
	light: React.ReactNode;
	/** Rendered in dark mode (`.dark` or system-dark). */
	dark: React.ReactNode;
}

/**
 * A single logo variant — either a theme-agnostic `ReactNode` rendered in
 * both modes, or a `{ light, dark }` pair for mode-specific renditions.
 */
type LogoVariant = ThemedLogoVariant | React.ReactNode;

/** The complete set of logo variants supplied to the provider. */
interface LogoSet {
	/**
	 * Compact icon — the rounded-square monogram.
	 * Used in collapsed sidebars, favicons, and small avatar-style contexts.
	 */
	icon?: LogoVariant;
	/**
	 * Full logo — icon + wordmark side-by-side.
	 * Used in expanded sidebars, page headers, and landing pages.
	 */
	full?: LogoVariant;
	/**
	 * Wordmark only — the "RaineStack" text without the icon.
	 * Used where the icon is rendered separately or omitted entirely.
	 */
	wordmark?: LogoVariant;
}

interface LogoProviderProps {
	children: React.ReactNode;
	/** Brand logos keyed by variant. */
	logos: LogoSet;
}

/** Resolved logo state — every variant is ready to render. */
interface LogoState {
	/** Compact icon for the active colour mode, or `null` if not provided. */
	icon: React.ReactNode;
	/** Full logo for the active colour mode, or `null` if not provided. */
	full: React.ReactNode;
	/** Wordmark for the active colour mode, or `null` if not provided. */
	wordmark: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LogoContext = createContext<LogoSet | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the value is a `{ light, dark }` themed pair rather
 * than a plain `ReactNode`. React elements are objects but never carry both
 * `light` and `dark` own-properties, so the check is safe.
 */
function isThemed(variant: LogoVariant): variant is ThemedLogoVariant {
	return (
		variant !== null && variant !== undefined && typeof variant === 'object' && 'light' in variant && 'dark' in variant
	);
}

/** Resolves a single variant to a renderable `ReactNode`. */
function resolveVariant(variant: LogoVariant | undefined, mode: 'light' | 'dark'): React.ReactNode {
	if (variant === undefined) return null;
	return isThemed(variant) ? variant[mode] : variant;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Stores the brand logo set in context for consumption via {@link useLogo}.
 *
 * Must be mounted **inside** `<ThemeProvider>` — the companion hook reads
 * the active theme to resolve themed variants.
 */
function LogoProvider({ children, logos }: LogoProviderProps) {
	// The logos object reference is stable (provided once at the entry point),
	// so we can pass it directly without additional memoisation.
	return <LogoContext.Provider value={logos}>{children}</LogoContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the resolved logo variants.
 *
 * Theme-agnostic variants are returned as-is. Themed `{ light, dark }`
 * variants are resolved against the active colour mode. Missing variants
 * resolve to `null`.
 *
 * Uses `resolvedTheme` from `useTheme()` so that `"system"` preferences
 * are already evaluated — including reactive updates when the OS-level
 * `prefers-color-scheme` changes.
 *
 * @throws If called outside a `<LogoProvider>`.
 *
 * @example
 * ```tsx
 * function SidebarBrand() {
 *   const { icon } = useLogo();
 *   return <div className="size-8">{icon}</div>;
 * }
 * ```
 */
function useLogo(): LogoState {
	const logos = useContext(LogoContext);

	if (logos === undefined) {
		throw new Error('useLogo must be used within a <LogoProvider>');
	}

	const { resolvedTheme } = useTheme();

	return useMemo<LogoState>(
		() => ({
			icon: resolveVariant(logos.icon, resolvedTheme),
			full: resolveVariant(logos.full, resolvedTheme),
			wordmark: resolveVariant(logos.wordmark, resolvedTheme)
		}),
		[logos, resolvedTheme]
	);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { LogoProvider, useLogo };
export type { LogoProviderProps, LogoSet, LogoState, LogoVariant, ThemedLogoVariant };
