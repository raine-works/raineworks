/**
 * Brand logo block — icon + two-tone "RaineStack" wordmark.
 *
 * Two composable pieces are exported:
 *
 * - **`BrandWordmark`** — the two-tone "RaineStack" text on its own. Use
 *   this in contexts where the icon is rendered separately (e.g. the
 *   sidebar, where the icon and text must be sibling elements for the
 *   collapse animation to work).
 *
 * - **`BrandLogo`** — the full composition (icon + wordmark) wrapped in
 *   a single flex container. Use this in standalone contexts like the
 *   landing page hero, login card header, and onboarding hub.
 *
 * Both accept a `size` prop with three presets:
 *
 * - **`sm`** — compact, for nav bars and footers.
 * - **`default`** — standard, for login cards and onboarding headers.
 * - **`lg`** — hero-sized, for the landing page.
 *
 * @module components/blocks/brand-logo
 */

import { cn } from '@ui/lib/utils';
import { useLogo } from '@ui/providers/logo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrandSize = 'sm' | 'default' | 'lg';

interface BrandWordmarkProps {
	/** Visual size preset. */
	size?: BrandSize;
	/** Merged onto the root `<span>` element. */
	className?: string;
}

interface BrandLogoProps {
	/** Visual size preset. */
	size?: BrandSize;
	/** When `true`, only the icon is rendered (no wordmark text). */
	iconOnly?: boolean;
	/** Merged onto the root element. */
	className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ICON_SIZES: Record<BrandSize, string> = {
	sm: 'size-7',
	default: 'size-9',
	lg: 'size-14'
};

const TEXT_SIZES: Record<BrandSize, string> = {
	sm: 'text-base',
	default: 'text-xl',
	lg: 'text-4xl'
};

// ---------------------------------------------------------------------------
// BrandWordmark
// ---------------------------------------------------------------------------

/**
 * Two-tone "RaineStack" wordmark — "Raine" in the foreground colour,
 * "Stack" in the primary accent.
 *
 * Renders as an inline `<span>` so it can sit naturally inside sidebar
 * menu buttons, headings, or alongside other inline content.
 */
function BrandWordmark({ size = 'default', className }: BrandWordmarkProps) {
	return (
		<span className={cn('font-semibold leading-tight tracking-tight', TEXT_SIZES[size], className)}>
			Raine<span className="text-primary">Stack</span>
		</span>
	);
}

// ---------------------------------------------------------------------------
// BrandLogo
// ---------------------------------------------------------------------------

/**
 * Full brand logo — icon + wordmark in a flex row.
 *
 * For contexts where the icon and text need to be **separate siblings**
 * (e.g. inside `SidebarMenuButton` for collapse behaviour), use
 * `useLogo()` for the icon and `<BrandWordmark>` for the text instead.
 */
function BrandLogo({ size = 'default', iconOnly = false, className }: BrandLogoProps) {
	const { icon } = useLogo();

	return (
		<div className={cn('flex items-center gap-2', size === 'lg' && 'gap-3', className)}>
			<div className={cn('shrink-0', ICON_SIZES[size])}>{icon}</div>

			{!iconOnly && <BrandWordmark size={size} />}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { BrandLogo, BrandWordmark };
export type { BrandLogoProps, BrandSize, BrandWordmarkProps };
