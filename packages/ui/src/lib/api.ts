/**
 * The browser's connection to the API, shared by every component in a zone:
 * one typed `hc` client and one TanStack Query cache per page load.
 *
 * All zones are served from one origin, so they share cookies and
 * `localStorage`. Once the app has sign-in, the session belongs here (resumed
 * as this module loads, so it's in flight while the rest of the zone is still
 * being evaluated) and the client's `fetch` carries it.
 *
 * @module lib/api
 */

import { type ApiClient, createApiClient, createApiFetch } from '@raineworks/api';
import { tryCatch } from '@raineworks/tools/prototypes';
import { QueryClient } from '@tanstack/react-query';

/** An error response from the API: `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
	override readonly name = 'ApiError' as const;

	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details?: unknown,
	) {
		super(message);
	}
}

interface ErrorBody {
	error?: { code?: string; message?: string; details?: unknown };
}

let failedRequestId: string | null = null;
let failedAt = 0;
/** A failure older than this isn't what someone reporting a problem means. */
const FAILURE_RELEVANT_MS = 5 * 60_000;

/** The `x-request-id` of a request that failed on this page in the last few minutes, for a problem report. */
export const lastFailedRequestId = () => (Date.now() - failedAt < FAILURE_RELEVANT_MS ? failedRequestId : null);

/**
 * Resolves an `hc` response to its JSON body, or throws an {@link ApiError}
 * carrying the server's code and user-facing message.
 */
export async function unwrap<R extends { ok: boolean; status: number; json(): Promise<unknown> }>(
	response: R | Promise<R>,
): Promise<Awaited<ReturnType<R['json']>>> {
	const res = await response;
	const { data: body } = await tryCatch(() => res.json());
	if (!res.ok) {
		failedRequestId = 'headers' in res && res.headers instanceof Headers ? res.headers.get('x-request-id') : null;
		failedAt = Date.now();
		const error = (body as ErrorBody | null)?.error;
		throw new ApiError(res.status, error?.code ?? 'unknown', error?.message ?? 'Something went wrong.', error?.details);
	}
	return body as Awaited<ReturnType<R['json']>>;
}

/** A message safe to show the user for any thrown value. */
export function errorMessage(error: unknown): string {
	if (error instanceof ApiError) return error.message;
	return 'Something went wrong. Please try again.';
}

/** The typed API client, same-origin. Read through `unwrap`, which throws an `ApiError` on any non-2xx. */
export const api: ApiClient = createApiClient({ url: '' });

/** `fetch` as the typed client sends, for the few routes outside it (a file download, say). */
export const apiFetch = createApiFetch({ url: '' });

/**
 * The one query cache every zone's root provides. A refusal (a 4xx) isn't retried; a server error or dropped connection
 * is, twice.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			// A refusal won't change by asking again; a server error or a dropped connection might.
			retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
			refetchOnWindowFocus: false,
		},
	},
});
