/**
 * Shared TanStack Query provider for all micro-frontend zones.
 *
 * Wraps the application in a {@link QueryClientProvider} with a stable
 * {@link QueryClient} instance. Each zone mounts its own instance, but the
 * configuration and defaults are shared here.
 *
 * @module lib/query-provider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default stale time — prevents immediate refetching on mount (ms). */
const DEFAULT_STALE_TIME = 60_000;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new {@link QueryClient} with shared defaults. Exported for
 * advanced use-cases (e.g. prefetching outside of React). Prefer using
 * {@link QueryProvider} for normal usage.
 */
function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: DEFAULT_STALE_TIME,
				refetchOnWindowFocus: false,
				retry: 1
			},
			mutations: {
				retry: false
			}
		}
	});
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface QueryProviderProps {
	children: React.ReactNode;
}

/**
 * Mounts a {@link QueryClientProvider} with a stable, zone-scoped
 * {@link QueryClient}. Place this inside the provider stack of each
 * micro-frontend entry point.
 *
 * Uses `useState` initialiser to guarantee a single `QueryClient` instance
 * per React tree — safe under `<StrictMode>` and concurrent features.
 */
function QueryProvider({ children }: QueryProviderProps) {
	const [queryClient] = useState(createQueryClient);

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { createQueryClient, QueryProvider };
export type { QueryProviderProps };
