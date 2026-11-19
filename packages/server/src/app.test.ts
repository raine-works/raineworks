import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

// A built zone of its own, served through `WEB_DIST`, read when `lib/env` is first imported (below).
const webDist = mkdtempSync(join(tmpdir(), 'raineworks-web-'));
const zoneDir = join(webDist, 'marketing');
mkdirSync(zoneDir, { recursive: true });
await Bun.write(
	join(zoneDir, 'index.html'),
	'<!doctype html><html><head><title>raineworks</title></head><body><div id="root"></div></body></html>',
);
await Bun.write(join(zoneDir, 'chunk-abcdefgh.js'), 'console.log("hello");');
await Bun.write(join(zoneDir, 'chunk-abcdefgh.js.br'), brotliCompressSync('console.log("hello");'));
await Bun.write(join(zoneDir, 'build.json'), JSON.stringify({ version: '2026.11.1', commit: '1234567' }));
Bun.env.WEB_DIST = webDist;

const { createApp } = await import('@raineworks/server/app');
const app = createApp();
const get = (path: string, headers: Record<string, string> = {}) =>
	app.request(`http://raineworks.test${path}`, { headers });

afterAll(() => rmSync(webDist, { recursive: true, force: true }));

describe('the probes', () => {
	test('answer outside /api', async () => {
		expect(await (await get('/healthz')).text()).toBe('ok');
		expect(await (await get('/readyz')).json()).toEqual({ status: 'ok' });
	});
});

describe('the API', () => {
	test('says which build a zone is serving, never cached', async () => {
		const response = await get('/api/build?zone=marketing');
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		const body = (await response.json()) as { build: string | null; version: string | null; commit: string | null };
		expect(body.version).toBe('2026.11.1');
		expect(body.commit).toBe('1234567');
		expect(body.build).toMatch(/^[\w-]{27}$/);
	});

	test('refuses a zone that doesn’t exist', async () => {
		const response = await get('/api/build?zone=nowhere');
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: { code: 'invalid_request' } });
	});

	test('answers an unknown route with a JSON 404, never the site', async () => {
		const response = await get('/api/nothing-here');
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: { code: 'not_found', message: 'Not found.' } });
	});
});

describe('the contact form', () => {
	const post = (body: string, headers: Record<string, string> = {}) =>
		app.request('http://raineworks.test/api/contact', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body,
		});

	test('acknowledges a valid submission with a 202', async () => {
		const response = await post(JSON.stringify({ name: ' Ada ', email: 'ada@example.com', message: 'Hello' }));
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ received: true });
	});

	test('refuses what isn’t a valid submission, saying what’s wrong', async () => {
		const missing = await post(JSON.stringify({ name: 'Ada', email: 'not-an-email', message: 'Hi' }));
		expect(missing.status).toBe(400);
		expect(await missing.json()).toEqual({
			error: {
				code: 'invalid_request',
				message: 'That doesn’t look like an email address.',
				details: { email: ['That doesn’t look like an email address.'] },
			},
		});
		const blank = await post(JSON.stringify({ name: '   ', email: 'ada@example.com', message: 'Hi' }));
		expect(blank.status).toBe(400);
		const malformed = await post('{not json');
		expect(malformed.status).toBe(400);
		expect(await malformed.json()).toMatchObject({ error: { code: 'invalid_request' } });
	});

	test('refuses a body over the limit before reading it', async () => {
		const response = await post(JSON.stringify({ name: 'Ada', email: 'ada@example.com', message: 'x'.repeat(20_000) }));
		expect(response.status).toBe(413);
		expect(await response.json()).toMatchObject({ error: { code: 'payload_too_large' } });
	});
});

describe('the API’s document', () => {
	test('is served at /api/openapi.json, cached publicly', async () => {
		const response = await get('/api/openapi.json');
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
		const spec = (await response.json()) as { info: { version: string }; paths: Record<string, unknown> };
		// The version of the build being served (here, the test's zone).
		expect(spec.info.version).toBe('2026.11.1 (1234567)');
		expect(Object.keys(spec.paths)).toContain('/api/contact');
	});
});

describe('the marketing zone', () => {
	let etag: string | null = null;

	beforeAll(async () => {
		etag = (await get('/')).headers.get('etag');
	});

	test('serves its page at the root and for any route it handles itself, stamped with its build', async () => {
		for (const path of ['/', '/projects', '/work/']) {
			const response = await get(path);
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toStartWith('text/html');
			expect(await response.text()).toContain('<meta name="raineworks-build"');
		}
	});

	test('answers a repeat visit from its ETag with a 304', async () => {
		expect(etag).not.toBeNull();
		const response = await get('/', { 'if-none-match': etag ?? '' });
		expect(response.status).toBe(304);
	});

	test('sends a hashed asset precompressed, cached for a year', async () => {
		const response = await get('/chunk-abcdefgh.js', { 'accept-encoding': 'br, gzip' });
		expect(response.status).toBe(200);
		expect(response.headers.get('content-encoding')).toBe('br');
		expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
	});

	test('answers a missing file with a 404, not the page', async () => {
		expect((await get('/missing-abcdefgh.js')).status).toBe(404);
	});

	test('sets the security headers on every page', async () => {
		const response = await get('/');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});
});
