import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { utils } from 'ssh2';
import { loadHostKey } from '@/server';

const { private: pem } = utils.generateKeyPairSync('ed25519');

describe('loadHostKey', () => {
	test('reads PEM from SSH_HOST_KEY', () => {
		expect(loadHostKey({ SSH_HOST_KEY: pem }).toString()).toBe(pem.trim());
	});

	test('accepts a single-line value with literal \\n escapes', () => {
		const oneLine = pem.trim().replace(/\n/g, '\\n');
		expect(loadHostKey({ SSH_HOST_KEY: oneLine }).toString()).toBe(pem.trim());
	});

	test('tolerates surrounding quotes from .env-style stores', () => {
		const quoted = `"${pem.trim().replace(/\n/g, '\\n')}"`;
		expect(loadHostKey({ SSH_HOST_KEY: quoted }).toString()).toBe(pem.trim());
	});

	test('reads from SSH_HOST_KEY_PATH', () => {
		const path = join(mkdtempSync(join(tmpdir(), 'hk-')), 'key');
		writeFileSync(path, pem);
		expect(loadHostKey({ SSH_HOST_KEY_PATH: path }).toString()).toBe(pem);
	});

	test('fails with a clear message when nothing is configured', () => {
		expect(() => loadHostKey({})).toThrow(/no host key/);
	});

	test('fails clearly when the file is missing', () => {
		expect(() => loadHostKey({ SSH_HOST_KEY_PATH: '/nonexistent/key' })).toThrow(/ENOENT/);
	});

	test('rejects garbage and public keys', () => {
		expect(() => loadHostKey({ SSH_HOST_KEY: 'not a key' })).toThrow(/not a valid private key/);
		const { public: pub } = utils.generateKeyPairSync('ed25519');
		expect(() => loadHostKey({ SSH_HOST_KEY: pub })).toThrow();
	});
});
