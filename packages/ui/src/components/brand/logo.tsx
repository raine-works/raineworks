/**
 * Brand logo components — RaineStack visual identity.
 *
 * Exports a pre-built {@link LogoSet} containing light and dark icon
 * variants ready to pass directly to `<LogoProvider>`.
 *
 * The **icon** variant uses a transparent PNG placed inside a styled
 * container. Separate light and dark renditions are provided so the
 * logo looks its best against each background:
 *
 * - **Light mode** — `bg-brand-500` container with higher contrast.
 * - **Dark mode** — `bg-brand-400` container for better visibility on
 *   dark surfaces.
 *
 * To update the brand artwork, replace the placeholder PNG in
 * `src/assets/` with the final file — the filename must stay the same:
 *
 * - `logo-icon.png` — compact monogram (transparent background)
 *
 * @module components/brand/logo
 */

import { cn } from '@ui/lib/utils';
import type { LogoSet } from '@ui/providers/logo';

// ---------------------------------------------------------------------------
// PNG asset import (Vite resolves this to a hashed URL string)
// ---------------------------------------------------------------------------

import logoIcon from '@ui/assets/logo-icon.png';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogoProps {
	/** Merged onto the outermost element for external sizing. */
	className?: string;
}

// ---------------------------------------------------------------------------
// Icon — compact monogram (transparent PNG on a branded container)
// ---------------------------------------------------------------------------

/**
 * Base icon renderer shared by both light and dark variants.
 *
 * Accepts an additional `containerClassName` to apply mode-specific
 * background and styling on top of the shared layout classes.
 */
function IconBase({ className, containerClassName }: LogoProps & { containerClassName?: string }) {
	return (
		<div className={cn('flex items-center justify-center rounded-lg p-1.5', containerClassName, className)}>
			<img src={logoIcon} alt="RaineStack" draggable={false} className="size-full object-contain" />
		</div>
	);
}

/**
 * Light-mode icon — transparent PNG monogram on a `bg-brand-500`
 * container for strong contrast against light backgrounds.
 */
function IconLight({ className }: LogoProps) {
	return <IconBase className={className} containerClassName="bg-brand-500" />;
}

/**
 * Dark-mode icon — transparent PNG monogram on a `bg-brand-400`
 * container for better visibility against dark backgrounds.
 */
function IconDark({ className }: LogoProps) {
	return <IconBase className={className} containerClassName="bg-brand-400" />;
}

/**
 * Theme-agnostic icon — falls back to `bg-brand-500`. Useful when you
 * need a single component outside of themed contexts.
 */
function Icon({ className }: LogoProps) {
	return <IconBase className={className} containerClassName="bg-brand-500" />;
}

// ---------------------------------------------------------------------------
// Pre-built LogoSet
// ---------------------------------------------------------------------------

/**
 * The complete logo set for the RaineStack brand.
 *
 * Pass this directly to `<LogoProvider logos={logos}>` in each zone's
 * `main.tsx` entry point. The provider + `useLogo()` hook will resolve
 * the correct light / dark rendition automatically.
 *
 * The icon uses a `{ light, dark }` themed pair so each mode gets
 * the most appropriate container styling.
 */
const logos: LogoSet = {
	icon: {
		light: <IconLight className="size-full" />,
		dark: <IconDark className="size-full" />
	}
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { Icon, IconDark, IconLight, logos };
export type { LogoProps };
