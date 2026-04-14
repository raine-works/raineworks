/**
 * Re-exports oRPC TanStack Query utilities for frontend zone consumption.
 *
 * Zones import {@link createTanstackQueryUtils} from this subpath instead of
 * depending on `@orpc/tanstack-query` directly. This keeps the oRPC TanStack
 * Query integration centralised in the API package — the same pattern used
 * for the oRPC client itself.
 *
 * @module lib/tanstack-query
 */

export { createTanstackQueryUtils } from '@orpc/tanstack-query';
