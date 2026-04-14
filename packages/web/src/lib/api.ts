/**
 * Shared API client and TanStack Query utilities for the web (shell/host)
 * micro-frontend.
 *
 * Initialises a single, fully-typed oRPC client using the server's contract
 * router and creates TanStack Query utilities for type-safe query/mutation
 * options. The module-level top-level `await` ensures the client is ready
 * before any component renders — Vite's ESM pipeline handles this natively.
 *
 * @module lib/api
 */

import { createApiClient } from '@rainestack/api';
import type { Router } from '@rainestack/api/router';
import { createTanstackQueryUtils } from '@rainestack/api/tanstack-query';

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

export const api = await createApiClient<Router>(location.origin);

// ---------------------------------------------------------------------------
// TanStack Query utilities
// ---------------------------------------------------------------------------

export const orpc = createTanstackQueryUtils(api);
