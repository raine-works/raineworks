/**
 * Type-safe oRPC API client factory.
 *
 * Creates a fully-typed API client from the server's contract router. The
 * contract is fetched once from the server and cached in `sessionStorage` to
 * avoid redundant network requests on subsequent page loads.
 *
 * The client's custom `fetch` wrapper handles:
 * - **Automatic authorization** — attaches the stored JWT access token to every request.
 * - **Transparent token refresh** — on a 401 response, attempts a single refresh
 *   and retries the original request with the new access token.
 * - **Request timeouts** — aborts requests that exceed `REQUEST_TIMEOUT_MS`.
 *
 * @module index
 */

import { storage } from '@api/lib/storage';
import { createORPCClient } from '@orpc/client';
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { tryCatch } from '@rainestack/tools/try-catch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export const createApiClient = async <T extends AnyContractRouter>(url: string) => {
	let router: T | null = null;
	const contractRouter = await storage.session.get('contractRouter');

	if (contractRouter) {
		router = JSON.parse(contractRouter);
	}

	if (!router) {
		const { error, data } = await tryCatch(fetch(`${url}/api/contract.json`));

		if (error || !data) {
			console.log(error?.message);
			throw new Error('Cannot find contract.json');
		}

		router = (await data.json()) as T;
		await storage.session.set('contractRouter', JSON.stringify(router));
	}

	const link = new OpenAPILink(router, {
		url: `${url}/api`,
		async fetch(request, init) {
			// 1. Setup Timeout Controller
			const timeoutController = new AbortController();
			const timeoutId = setTimeout(() => {
				timeoutController.abort(new Error('RPC_TIMEOUT'));
			}, REQUEST_TIMEOUT_MS);

			// Combine all abort signals: the 15-second timeout, the
			// caller's signal from the oRPC Request object, and any
			// signal on the init object. oRPC places the caller's
			// signal on `request.signal`, not `init.signal`.
			const signals: AbortSignal[] = [timeoutController.signal];

			if (request.signal && !request.signal.aborted) {
				signals.push(request.signal);
			}

			const requestInit = init as RequestInit;
			if (requestInit?.signal && !requestInit.signal.aborted) {
				signals.push(requestInit.signal);
			}

			const signal = signals.length > 1 && 'any' in AbortSignal ? AbortSignal.any(signals) : signals[0];

			try {
				const accessToken = await storage.local.get('accessToken');
				const headers = new Headers(request.headers);
				if (accessToken) {
					headers.set('Authorization', `Bearer ${accessToken}`);
				}

				const isGetOrHead = ['GET', 'HEAD'].includes(request.method.toUpperCase());

				// Consume the body once so it can be reused for the retry.
				const body = isGetOrHead ? undefined : await request.blob();

				// ── First attempt ──────────────────────────────────────
				let response = await fetch(request.url, {
					body,
					headers,
					method: request.method,
					signal: signal,
					...init
				});

				// ── 401 → refresh + retry ──────────────────────────────
				if (response.status === 401) {
					const refreshToken = await storage.local.get('refreshToken');

					if (refreshToken) {
						const newAccessToken = await refreshAccessToken(url, refreshToken);

						if (newAccessToken) {
							const retryHeaders = new Headers(headers);
							retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);

							response = await fetch(request.url, {
								body,
								headers: retryHeaders,
								method: request.method,
								signal: signal,
								...init
							});
						}
					}
				}

				// ── SSE: clear the timeout for long-lived streams ──────
				// The timeout guards against the initial connection
				// hanging. Once an event-stream response arrives, the
				// connection is meant to stay open indefinitely — clear
				// the timer so it does not kill the stream after 15 s.
				if (response.headers.get('content-type')?.startsWith('text/event-stream')) {
					clearTimeout(timeoutId);
				}

				return response;
			} catch (err) {
				throw err;
			} finally {
				clearTimeout(timeoutId);
			}
		}
	});

	return createORPCClient<JsonifiedClient<ContractRouterClient<T>>>(link);
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Calls the backend `/auth/refresh` endpoint to exchange a refresh token for
 * a new access token. On success the new access token is persisted to local
 * storage. On failure both tokens are cleared so the user is forced to
 * re-authenticate.
 */
const refreshAccessToken = async (url: string, refreshToken: string): Promise<string | null> => {
	try {
		const response = await fetch(`${url}/api/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken })
		});

		if (!response.ok) throw new Error('Refresh request failed');

		const data = await response.json();
		if (data.tokens?.accessToken) {
			await storage.local.set('accessToken', data.tokens.accessToken);
			if (data.tokens.refreshToken) {
				await storage.local.set('refreshToken', data.tokens.refreshToken);
			}
			return data.tokens.accessToken;
		}
	} catch (e) {
		console.error('Refresh failed', e);
	}

	// Refresh failed — clear everything so the user is forced to log in again.
	await storage.local.delete('accessToken');
	await storage.local.delete('refreshToken');
	return null;
};
