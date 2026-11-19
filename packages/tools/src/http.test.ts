import { describe, expect, test } from 'bun:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { compressBytes, isCompressible, isContentHashed, negotiateEncoding } from '@raineworks/tools/http';

describe('negotiateEncoding', () => {
	test('prefers brotli, then gzip, then identity', () => {
		expect(negotiateEncoding('gzip, deflate, br, zstd')).toBe('br');
		expect(negotiateEncoding('gzip, deflate')).toBe('gzip');
		expect(negotiateEncoding('deflate')).toBeNull();
		expect(negotiateEncoding('identity')).toBeNull();
		expect(negotiateEncoding('')).toBeNull();
		expect(negotiateEncoding(null)).toBeNull();
	});

	test('honours q-values, refusals and the wildcard', () => {
		expect(negotiateEncoding('br;q=0.5, gzip;q=0.8')).toBe('gzip');
		expect(negotiateEncoding('br;q=0, gzip')).toBe('gzip');
		expect(negotiateEncoding('br;q=0, gzip;q=0')).toBeNull();
		expect(negotiateEncoding('*')).toBe('br');
		expect(negotiateEncoding('*;q=0.1, br;q=0')).toBe('gzip');
		expect(negotiateEncoding('BR ; q=1.0')).toBe('br');
		expect(negotiateEncoding('br;q=nonsense')).toBeNull();
	});
});

describe('compressBytes', () => {
	const text = JSON.stringify({ rows: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `row ${i}` })) });

	test('round-trips, at both levels, and shrinks text', () => {
		for (const level of ['fast', 'max'] as const) {
			const br = compressBytes(text, 'br', level);
			const gz = compressBytes(text, 'gzip', level);
			expect(brotliDecompressSync(br).toString()).toBe(text);
			expect(gunzipSync(gz).toString()).toBe(text);
			expect(br.byteLength).toBeLessThan(text.length / 4);
		}
	});
});

describe('asset naming', () => {
	test('recognises Bun’s content-hashed names, for chunks and assets alike', () => {
		expect(isContentHashed('chunk-jxjybjk2.js')).toBe(true);
		expect(isContentHashed('/auth/chunk-5j0ae87n.css')).toBe(true);
		expect(isContentHashed('raineworks-mark-c5ht1nvs.png')).toBe(true);
		expect(isContentHashed('chunk-jxjybjk2.js.map')).toBe(true);
		expect(isContentHashed('index.html')).toBe(false);
		expect(isContentHashed('logo.png')).toBe(false);
		expect(isContentHashed('chunk-ABCDEFGH.js')).toBe(false);
		// Words that only look like a hash: each has a letter Bun's base-32 alphabet leaves out (i, l, o, u).
		expect(isContentHashed('site-manifest.json')).toBe(false);
		expect(isContentHashed('/brand/logo-original.svg')).toBe(false);
		expect(isContentHashed('app-download.png')).toBe(false);
	});

	test('compresses text outputs only', () => {
		for (const name of ['a.js', 'a.mjs', 'a.css', 'a.html', 'a.svg', 'a.json', 'a.txt', 'a.xml']) {
			expect(isCompressible(name)).toBe(true);
		}
		for (const name of ['a.png', 'a.woff2', 'a.js.br', 'a.css.gz']) expect(isCompressible(name)).toBe(false);
	});
});
