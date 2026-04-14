/**
 * JWT authentication middleware.
 *
 * Provides stateless authentication by verifying JWT access tokens
 * on every request — **no database query is performed**. The only
 * time the database is touched is when the client explicitly
 * refreshes its token pair via the `/auth/refresh` endpoint.
 *
 * Exports two middleware:
 *
 * - **`authMiddleware`** — runs on every request as part of the base
 *   middleware chain. Extracts the JWT from the `Authorization`
 *   header (or cookie fallback), verifies its signature and expiry,
 *   and injects `user` and `jwtPayload` into the oRPC context as
 *   nullable values.
 *
 * - **`authGuard`** — narrows the nullable `user` / `jwtPayload` to
 *   non-null, throwing `UNAUTHORIZED` if no valid JWT was presented.
 *   Used by `authedProcedure` in `orpc.ts`.
 *
 * @module auth
 */

import { ORPCError, os } from '@orpc/server';
import type { DatabaseContext } from '@server/lib/database';
import { type JwtPayload, type JwtUser, payloadToUser, verifyAccessToken } from '@server/lib/jwt';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the HTTP cookie that carries the access token (if used). */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/** Name of the HTTP cookie that carries the refresh token (if used). */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the bearer token from the incoming request headers.
 *
 * Checks (in order):
 * 1. `Authorization: Bearer <token>` header
 * 2. `access_token` cookie
 *
 * Returns `null` if no token is found.
 */
export function extractToken(headers: Headers): string | null {
	// 1. Bearer token
	const auth = headers.get('authorization');
	if (auth?.startsWith('Bearer ')) {
		const token = auth.slice(7).trim();
		if (token.length > 0) return token;
	}

	// 2. Cookie
	const cookies = headers.get('cookie');
	if (cookies) {
		const match = cookies.split(';').find((c) => c.trim().startsWith(`${ACCESS_TOKEN_COOKIE}=`));
		if (match) {
			const value = match.split('=')[1]?.trim();
			if (value && value.length > 0) return value;
		}
	}

	return null;
}

/**
 * Extracts the refresh token from the incoming request headers.
 *
 * Looks for a `refresh_token` cookie. Refresh tokens are not sent
 * via the Authorization header — that slot is reserved for the
 * short-lived access token.
 */
export function extractRefreshToken(headers: Headers): string | null {
	const cookies = headers.get('cookie');
	if (cookies) {
		const match = cookies.split(';').find((c) => c.trim().startsWith(`${REFRESH_TOKEN_COOKIE}=`));
		if (match) {
			const value = match.split('=')[1]?.trim();
			if (value && value.length > 0) return value;
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

/**
 * Context shape added by {@link authMiddleware}.
 *
 * Present on every request — public routes see `null` values while
 * authenticated routes are narrowed to non-null by {@link authGuard}.
 */
export interface AuthContext {
	/** The authenticated user reconstructed from JWT claims, or `null`. */
	user: JwtUser | null;
	/** The raw JWT payload (decoded claims), or `null`. */
	jwtPayload: JwtPayload | null;
}

/**
 * Narrowed auth context available inside `authedProcedure` handlers.
 *
 * Both `user` and `jwtPayload` are guaranteed to be non-null.
 */
export interface AuthenticatedContext {
	user: JwtUser;
	jwtPayload: JwtPayload;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Verifies the JWT access token on every request — **no database hit**.
 *
 * Extracts the token from the `Authorization: Bearer` header (or
 * cookie fallback), verifies the HS256 signature and `exp` claim,
 * and injects `user` and `jwtPayload` into the oRPC context.
 *
 * If the token is missing, expired, or invalid, both values are set
 * to `null` — public routes continue normally while protected routes
 * will be rejected by {@link authGuard}.
 *
 * This middleware requires `headers` to be present in the context.
 */
export const authMiddleware = os
	.$context<{ headers: Headers; db: DatabaseContext['db'] }>()
	.middleware(async ({ context, next }) => {
		const token = extractToken(context.headers);

		let user: JwtUser | null = null;
		let jwtPayload: JwtPayload | null = null;

		if (token) {
			const payload = await verifyAccessToken(token);
			if (payload) {
				jwtPayload = payload;
				user = payloadToUser(payload);
			}
		}

		return next({
			context: {
				user,
				jwtPayload
			} satisfies AuthContext
		});
	});

/**
 * Guard middleware that narrows the nullable `user` / `jwtPayload`
 * to non-null. Throws an `UNAUTHORIZED` oRPC error if no valid JWT
 * was presented.
 *
 * Intended to be composed on top of the base procedure to create
 * `authedProcedure` — see `orpc.ts`.
 */
export const authGuard = os
	.$context<{ user: JwtUser | null; jwtPayload: JwtPayload | null }>()
	.middleware(async ({ context, next }) => {
		if (!context.user || !context.jwtPayload) {
			throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' });
		}

		return next({
			context: {
				user: context.user,
				jwtPayload: context.jwtPayload
			} satisfies AuthenticatedContext
		});
	});
