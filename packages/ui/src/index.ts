/**
 * @rainestack/ui — Shared component library.
 *
 * Consumers should import components directly from their subpaths rather than
 * from this barrel to enable fine-grained tree-shaking:
 *
 * ```ts
 * import { Button } from '@rainestack/ui/components/ui/button';
 * import { Card }   from '@rainestack/ui/components/ui/card';
 * ```
 *
 * This entry point re-exports only the shared utilities and providers that are
 * used across many components and application code.
 *
 * @module index
 */

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { cn } from '@ui/lib/utils';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export { FaviconProvider, Head, HeadContent, type HeadContentProps } from '@ui/providers/head';
export {
	LogoProvider,
	type LogoProviderProps,
	type LogoSet,
	type LogoState,
	type LogoVariant,
	type ThemedLogoVariant,
	useLogo
} from '@ui/providers/logo';
export {
	type Theme,
	ThemeProvider,
	type ThemeProviderProps,
	type ThemeProviderState,
	useTheme
} from '@ui/providers/theme';
