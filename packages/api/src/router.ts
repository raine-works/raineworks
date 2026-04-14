/**
 * Re-exports the server's {@link Router} contract type for frontend packages.
 *
 * Frontend apps should import the `Router` type from the `@rainestack/api/router`
 * subpath instead of depending on `@rainestack/server` directly. This keeps the
 * server package out of each app's dependency list and centralises the
 * type-bridge in one place.
 *
 * @example
 * ```ts
 * import type { Router } from '@rainestack/api/router';
 * ```
 *
 * @module router
 */

export type { Router } from '@rainestack/server';
