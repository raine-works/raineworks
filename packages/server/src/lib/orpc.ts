/**
 * oRPC base configuration.
 *
 * Sets up the root operation-system instance, wires in global
 * middleware (database, request logging, auth, actor tracking), and
 * exports the base procedure builders that route files chain from.
 *
 * Middleware is applied in order:
 * 1. **database** — injects `db` (Prisma) and `listener` (LISTEN/NOTIFY).
 * 2. **request** — generates a request ID, creates a child Pino
 *    logger, logs the incoming request and outgoing response with
 *    timing. Injects `requestId` and `log` into the context.
 * 3. **auth**    — verifies the JWT access token and injects `user`
 *    and `jwtPayload` into the context (nullable on public routes).
 *    **No database query is performed.**
 * 4. **actor**   — reads the authenticated user's ID and injects
 *    `actorId` and a pre-bound `withActor` helper into the context.
 *    Route handlers use `context.withActor(fn)` to wrap writes in
 *    actor-tracked transactions for audit attribution.
 *
 * @module orpc
 */

import { os } from '@orpc/server';
import type { AuthContext, AuthenticatedContext } from '@server/lib/auth';
import { authGuard, authMiddleware } from '@server/lib/auth';
import type { ActorContext, DatabaseContext } from '@server/lib/database';
import { actorMiddleware, databaseMiddleware } from '@server/lib/database';
import type { RequestContext } from '@server/lib/logger';
import { requestMiddleware } from '@server/lib/logger';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

/** Context provided by the HTTP handler at the network edge. */
export type InitialContext = {
	headers: Headers;
};

/**
 * Fully-resolved context available after all base middleware has run.
 *
 * Every handler — public or authenticated — receives this shape.
 * `user` and `jwtPayload` are nullable; use `authedProcedure` to
 * narrow them to non-null.
 */
export type Context = InitialContext & DatabaseContext & RequestContext & AuthContext & ActorContext;

/**
 * Context available inside `authedProcedure` handlers.
 *
 * `user` and `jwtPayload` are guaranteed to be non-null.
 */
export type AuthedContext = InitialContext & DatabaseContext & RequestContext & AuthenticatedContext & ActorContext;

// ---------------------------------------------------------------------------
// Base procedure
// ---------------------------------------------------------------------------

const base = os
	.$context<InitialContext>()
	.use(databaseMiddleware)
	.use(requestMiddleware)
	.use(authMiddleware)
	.use(actorMiddleware);

/** Public procedure — no authentication required. */
const publicProcedure = base;

/**
 * Authenticated procedure — requires a valid JWT access token.
 *
 * Handlers chained from this procedure receive `context.user`
 * and `context.jwtPayload` as non-null values. Requests without a
 * valid JWT are rejected with an `UNAUTHORIZED` error.
 */
const authedProcedure = base.use(authGuard);

export { authedProcedure, base, publicProcedure };
