/**
 * Every zone router's `defaultErrorComponent`: what a page shows when it throws while rendering or loading, instead
 * of TanStack's unbranded "Something went wrong!". Built on `ErrorState`: the message (`errorMessage`) and Retry,
 * which re-renders the page and reruns its loader; a page whose chunk is gone after a release says the site was
 * updated and offers Reload (`lib/lazy`; `lazyRouteComponent` has already reloaded once by then).
 *
 * ```tsx
 * createRouter({ routeTree, defaultErrorComponent: RouteError, … });
 * ```
 *
 * @module blocks/route-error
 */

import { Page } from '@raineworks/ui/blocks/page';
import { ErrorState } from '@raineworks/ui/blocks/query-state';
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';

/** A page that failed: what went wrong, and Retry (or Reload, for a page from the build before). */
export function RouteError({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const retry = () => {
		reset();
		// Reruns the loaders too, so a page that failed in one gets another go.
		void router.invalidate();
	};
	return (
		<Page title="Something went wrong">
			<ErrorState error={error} onRetry={retry} title="Couldn’t show this page" className="text-left" />
		</Page>
	);
}
