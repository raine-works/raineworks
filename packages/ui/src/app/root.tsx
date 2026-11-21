/**
 * The root of every zone: providers (TanStack Query, tooltips, toasts, what's new) around the zone's TanStack Router,
 * with the theme, modal history, the focus-following favicon (`lib/favicon`) and the agent bridge (`lib/agent`)
 * connected before it renders.
 *
 * ```tsx
 * // packages/web-<zone>/src/main.tsx
 * await mountZone(router);
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
import { connectAgent } from '@raineworks/ui/lib/agent';
import { queryClient } from '@raineworks/ui/lib/api';
import { connectFavicon } from '@raineworks/ui/lib/favicon';
import { connectModalHistory } from '@raineworks/ui/lib/modal-history';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type AnyRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';

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
 * Renders a zone into `#root`, hydrating the page when it was prerendered (`app/prerender`). Call once from the zone's
 * entrypoint. Resolves to the React root, which a zone never unmounts but a test must: Testing Library's `cleanup()`
 * unmounts only what its `render()` mounted, and a root left mounted keeps its What's new dialog subscribed to
 * `openReleaseNotes()`, portalled into `document.body` (outside `#root`) whenever a later test opens it.
 */
export async function mountZone(router: AnyRouter): Promise<Root> {
	applyTheme();
	// Back closes the modal on top (`lib/modal-history`).
	connectModalHistory(router);
	// The gradient favicon while the page has focus, white on black while it doesn't (`lib/favicon`).
	connectFavicon();
	// An agent can use the page's ui-sdk components directly (`lib/agent`), the browser's own through WebMCP.
	connectAgent();
	const container = document.getElementById('root');
	if (!container) throw new Error('Missing #root element');
	const app = (
		<StrictMode>
			<ZoneRoot router={router} />
		</StrictMode>
	);
	if (!container.hasChildNodes()) {
		const root = createRoot(container);
		root.render(app);
		return root;
	}
	// The page is already there: its route's chunk loads first, so the first render is the markup it hydrates. Marked
	// as server-rendered, as TanStack's own hydration marks it, the router renders the tree it rendered at build time
	// (no Suspense boundary around the matches).
	router.ssr = { manifest: undefined };
	await router.load();
	return hydrateRoot(container, app);
}
