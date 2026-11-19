import { afterEach, describe, expect, test } from 'bun:test';

import { createApiClient, createApiFetch } from '@raineworks/api';

/** A `fetch` that records each request and answers with `respond`. */
function recording(respond: (input: RequestInfo | URL, init: RequestInit) => Response | Promise<Response>) {
	const seen: { url: string; init: RequestInit }[] = [];
	const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
		seen.push({ url: String(input), init });
		return respond(input, init);
	}) as typeof fetch;
	return { seen, fetch: fetchImpl };
}

describe('the API client', () => {
	test('calls the typed routes through the fetch it’s given', async () => {
		const build = { build: 'abc', version: '2026.11.1', commit: '1234567' };
		const { seen, fetch } = recording(() => Response.json(build));
		const api = createApiClient({ url: 'http://api.test/', fetch });
		const response = await api.api.build.$get({ query: { zone: 'marketing' } });
		expect(await response.json()).toEqual(build);
		expect(seen.map((request) => request.url)).toEqual(['http://api.test/api/build?zone=marketing']);
	});

	describe('with no server origin', () => {
		const location = Object.getOwnPropertyDescriptor(globalThis, 'location');
		afterEach(() => {
			if (location) Object.defineProperty(globalThis, 'location', location);
			else Reflect.deleteProperty(globalThis, 'location');
		});

		test('calls the page’s own origin in a browser', async () => {
			Object.defineProperty(globalThis, 'location', { value: { origin: 'https://app.test' }, configurable: true });
			const { seen, fetch } = recording(() => Response.json({ environment: 'test' }));
			await createApiClient({ url: '', fetch }).api.build.$get({ query: { zone: 'marketing' } });
			expect(seen.map((request) => request.url)).toEqual(['https://app.test/api/build?zone=marketing']);
		});

		test('calls a path of its own where there’s no page', async () => {
			Reflect.deleteProperty(globalThis, 'location');
			const { seen, fetch } = recording(() => Response.json({ environment: 'test' }));
			await createApiClient({ url: '/', fetch }).api.build.$get({ query: { zone: 'marketing' } });
			expect(seen.map((request) => new URL(request.url, 'http://x').pathname)).toEqual(['/api/build']);
		});
	});
});

describe('the API fetch', () => {
	test('passes the request through, and the response’s status, headers and url back', async () => {
		const upstream = new Response('created', {
			status: 201,
			statusText: 'Created',
			headers: { 'content-type': 'text/plain', 'x-request-id': 'req-1' },
		});
		Object.defineProperty(upstream, 'url', { value: 'http://api.test/api/things' });
		const { seen, fetch } = recording(() => upstream);
		const response = await createApiFetch({ url: 'http://api.test', fetch })('http://api.test/api/things', {
			method: 'POST',
			body: 'thing',
			headers: { 'content-type': 'text/plain' },
		});
		expect(seen[0]).toMatchObject({ url: 'http://api.test/api/things', init: { method: 'POST', body: 'thing' } });
		expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal);
		expect({
			status: response.status,
			statusText: response.statusText,
			id: response.headers.get('x-request-id'),
			url: response.url,
			body: await response.text(),
		}).toEqual({ status: 201, statusText: 'Created', id: 'req-1', url: 'http://api.test/api/things', body: 'created' });
	});

	test('returns a response with no body as it is', async () => {
		const upstream = new Response(null, { status: 204 });
		const response = await createApiFetch({ url: 'http://api.test', fetch: recording(() => upstream).fetch })(
			'http://api.test/api/things/1',
			{ method: 'DELETE' },
		);
		expect(response).toBe(upstream);
	});

	test('rethrows what the fetch throws, and its timeout never fires after', async () => {
		const failure = new TypeError('fetch failed');
		const { seen, fetch } = recording(() => Promise.reject(failure));
		const apiFetch = createApiFetch({ url: 'http://api.test', fetch, timeoutMs: 20 });
		await expect(apiFetch('http://api.test/api/config')).rejects.toBe(failure);
		await Bun.sleep(40);
		expect(seen[0]?.init.signal?.aborted).toBe(false);
	});

	test('aborts when the caller’s own signal does', async () => {
		const caller = new AbortController();
		const { seen, fetch } = recording(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				}),
		);
		const pending = createApiFetch({ url: 'http://api.test', fetch })('http://api.test/api/config', {
			signal: caller.signal,
		});
		caller.abort(new Error('navigated away'));
		await expect(pending).rejects.toThrow('navigated away');
		expect(seen[0]?.init.signal).not.toBe(caller.signal);
	});
});

describe('the request timeout', () => {
	/** A `fetch` whose response sends its headers at once and its body never, until the request is aborted. */
	const stalling = (contentType: string, cancelled: unknown[] = []) =>
		(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
			const body = new ReadableStream<Uint8Array>({
				start(controller) {
					init.signal?.addEventListener('abort', () => controller.error(init.signal?.reason));
				},
				cancel(reason) {
					cancelled.push(reason);
				},
			});
			return new Response(body, { headers: { 'content-type': contentType } });
		}) as typeof fetch;

	test('cuts off a request whose headers never come', async () => {
		const { fetch } = recording(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				}),
		);
		const apiFetch = createApiFetch({ url: 'http://api.test', fetch, timeoutMs: 20 });
		await expect(apiFetch('http://api.test/api/config')).rejects.toThrow('RPC_TIMEOUT');
	});

	test('still runs while the body is read, so a body that stalls is cut off', async () => {
		const apiFetch = createApiFetch({ url: 'http://api.test', fetch: stalling('application/json'), timeoutMs: 50 });
		const response = await apiFetch('http://api.test/api/config');
		expect(response.status).toBe(200);
		await expect(response.text()).rejects.toThrow('RPC_TIMEOUT');
	});

	test('stops once an event stream opens', async () => {
		const apiFetch = createApiFetch({ url: 'http://api.test', fetch: stalling('text/event-stream'), timeoutMs: 20 });
		const response = await apiFetch('http://api.test/api/events');
		const read = response.body?.getReader().read();
		const outcome = await Promise.race([read?.then(() => 'read'), Bun.sleep(100).then(() => 'still open')]);
		expect(outcome).toBe('still open');
	});

	test('stops when the body is cancelled, passing the cancel on to the response', async () => {
		const cancelled: unknown[] = [];
		const inner = stalling('application/json', cancelled);
		const { seen, fetch } = recording((input, init) => inner(input, init));
		const response = await createApiFetch({ url: 'http://api.test', fetch, timeoutMs: 50 })(
			'http://api.test/api/config',
		);
		await response.body?.cancel('not needed');
		expect(cancelled).toEqual(['not needed']);
		await Bun.sleep(80);
		expect(seen[0]?.init.signal?.aborted).toBe(false);
	});

	test('a body read in time comes through whole', async () => {
		const { fetch } = recording(() => Response.json({ environment: 'test' }));
		const response = await createApiFetch({ url: 'http://api.test', fetch, timeoutMs: 50 })(
			'http://api.test/api/config',
		);
		await Bun.sleep(80);
		expect(await response.json()).toEqual({ environment: 'test' });
	});

	test('stops once the body has been read to the end', async () => {
		const { seen, fetch } = recording(() => Response.json({ environment: 'test' }));
		const response = await createApiFetch({ url: 'http://api.test', fetch, timeoutMs: 50 })(
			'http://api.test/api/config',
		);
		expect(await response.json()).toEqual({ environment: 'test' });
		await Bun.sleep(80);
		expect(seen[0]?.init.signal?.aborted).toBe(false);
	});
});
