/**
 * `@raineworks/api` — the typed client for the API, for the web zones and any other client (a native app, a script).
 *
 * A Hono `hc` client over the server's `AppType`, so request and response types flow from the routes with no
 * codegen. Its `fetch` times requests out, the body's reading included (an event stream excepted, once open). Once the app has sign-in, this is
 * where the session belongs: a client that holds it, a `fetch` that attaches its token and refreshes it on a 401.
 *
 * @module @raineworks/api
 */

import type { AppType, Project } from '@raineworks/server';
import '@raineworks/tools/prototypes';
import { hc } from 'hono/client';

export type { AppType, Project };

const REQUEST_TIMEOUT_MS = 60_000;

/** Where the client sends requests, with what `fetch`, and how long each may take. */
export interface CreateApiClientOptions {
	/** Server origin, e.g. `"http://localhost:3000"`; `""` for same-origin web apps. */
	url: string;
	/** `fetch` override for tests or React Native polyfills. */
	fetch?: typeof globalThis.fetch;
	/** How long a request may take, its body included (60 s). */
	timeoutMs?: number;
}

/** The `fetch` {@link createApiClient} uses: exported for the few calls outside the typed client (event streams). */
export function createApiFetch(options: CreateApiClientOptions): typeof globalThis.fetch {
	const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
	const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
		const timeout = new AbortController();
		const timer = setTimeout(() => timeout.abort(new Error('RPC_TIMEOUT')), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
		const signal = init.signal ? AbortSignal.any([timeout.signal, init.signal]) : timeout.signal;
		const { data: response, error } = await fetchImpl(input, { ...init, signal }).tryCatch();
		if (error) {
			clearTimeout(timer);
			throw error;
		}
		// An open event stream stays open: the timeout guarded only its setup.
		if (!response.body || response.headers.get('content-type')?.startsWith('text/event-stream')) {
			clearTimeout(timer);
			return response;
		}
		return untilRead(response, () => clearTimeout(timer));
	};
	return apiFetch as typeof globalThis.fetch;
}

/**
 * `response` with `done` called once its body has been read to the end, failed or been cancelled: until then the
 * request's timeout still runs, so a server that sends its headers and then stalls is cut off too.
 */
function untilRead(response: Response, done: () => void): Response {
	const reader = (response.body as ReadableStream<Uint8Array>).getReader();
	const body = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { data: chunk, error } = await reader.read().tryCatch();
			if (error) {
				done();
				controller.error(error);
			} else if (chunk.done) {
				done();
				controller.close();
			} else controller.enqueue(chunk.value);
		},
		cancel(reason) {
			done();
			return reader.cancel(reason);
		},
	});
	const wrapped = new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
	Object.defineProperty(wrapped, 'url', { value: response.url });
	return wrapped;
}

/**
 * Fully typed client for the API:
 *
 * ```ts
 * const api = createApiClient({ url: '' });
 * const res = await api.api.config.$get();
 * if (res.ok) console.log((await res.json()).environment);
 * ```
 */
export function createApiClient(options: CreateApiClientOptions) {
	return hc<AppType>(options.url.replace(/\/$/, '') || globalThis.location?.origin || '', {
		fetch: createApiFetch(options),
	});
}

/** The typed client {@link createApiClient} returns. */
export type ApiClient = ReturnType<typeof createApiClient>;
