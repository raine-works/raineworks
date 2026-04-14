/**
 * 404 Not Found block — a full-page empty state for unmatched routes.
 *
 * Renders a centered message with a prominent 404 indicator, descriptive
 * copy, and a navigation button back to the zone's root. Each micro-frontend
 * zone passes its own `homeHref` so the button navigates to the correct
 * zone root (`/`, `/admin`, `/learn`).
 *
 * Uses a plain `<a>` tag for navigation so it works correctly for both
 * intra-zone and cross-zone links (each zone is a separate SPA).
 *
 * @module components/blocks/not-found
 */

import { Button } from '@ui/components/ui/button';
import { cn } from '@ui/lib/utils';
import { ArrowLeftIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotFoundProps {
	/** URL the "back" button navigates to. Defaults to `/`. */
	homeHref?: string;
	/** Label for the "back" button. Defaults to `"Back to home"`. */
	homeLabel?: string;
	/** Optional className merged onto the outer container. */
	className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function NotFound({ homeHref = '/', homeLabel = 'Back to home', className }: NotFoundProps) {
	return (
		<div className={cn('flex min-h-screen flex-col items-center justify-center px-4 text-center', className)}>
			<p className="text-sm font-semibold uppercase tracking-wide text-primary">404</p>
			<h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">Page not found</h1>
			<p className="mt-4 max-w-md text-base text-muted-foreground">
				Sorry, we couldn't find the page you're looking for. It may have been moved or no longer exists.
			</p>
			<a href={homeHref} className="mt-8">
				<Button size="lg">
					<ArrowLeftIcon data-icon="inline-start" />
					{homeLabel}
				</Button>
			</a>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { NotFound };
export type { NotFoundProps };
