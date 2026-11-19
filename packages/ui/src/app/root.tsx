/**
 * The root of every zone: providers (TanStack Query, tooltips, toasts, what's new) around the zone's TanStack Router.
 *
 * ```tsx
 * // packages/web-<zone>/src/main.tsx
 * mountZone(router);
 * ```
 *
 * Once the app has sign-in, the gate goes here: a signed-out visitor of a protected zone sent to sign in, the query
 * cache cleared as the user changes, and the zone remounted for each.
 *
 * @module app/root
 */

import '@raineworks/tools/prototypes';
import { ReleaseNotes } from '@raineworks/ui/blocks/release-notes';
import { Toaster } from '@raineworks/ui/components/sonner';
import { TooltipProvider } from '@raineworks/ui/components/tooltip';
import { applyTheme } from '@raineworks/ui/hooks/use-theme';
import { queryClient } from '@raineworks/ui/lib/api';
import { connectModalHistory } from '@raineworks/ui/lib/modal-history';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type AnyRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/** Context every zone's root route is created with (`createRootRouteWithContext<RouterContext>()`). */
export interface RouterContext {
	queryClient: QueryClient;
}

/** The zone's providers around its router. Rendered by {@link mountZone}. */
export function ZoneRoot({ router }: { router: AnyRouter }) {
	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider delayDuration={200}>
				<RouterProvider router={router} context={{ queryClient }} />
				<Toaster position="top-right" />
				<ReleaseNotes />
			</TooltipProvider>
		</QueryClientProvider>
	);
}

/**
 * Renders a zone into `#root`. Call once from the zone's entrypoint. Returns the React root, which a zone never
 * unmounts but a test must: Testing Library's `cleanup()` unmounts only what its `render()` mounted, and a root left
 * mounted keeps its What's new dialog subscribed to `openReleaseNotes()`, portalled into `document.body` (outside
 * `#root`) whenever a later test opens it.
 */
export function mountZone(router: AnyRouter): Root {
	applyTheme();
	// Back closes the modal on top (`lib/modal-history`).
	connectModalHistory(router);
	const container = document.getElementById('root');
	if (!container) throw new Error('Missing #root element');
	const root = createRoot(container);
	root.render(
		<StrictMode>
			<ZoneRoot router={router} />
		</StrictMode>,
	);
	return root;
}
