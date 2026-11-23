import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadHostKey } from '@raineworks/ssh/server';
import { LEADING_ZERO_HOST_KEY, TEST_HOST_KEY } from '@raineworks/ssh/server/test-host-keys';

// A fixed key, so every run tests the same one (see `test-host-keys` for why not ssh2's generator).
const { pem } = TEST_HOST_KEY;

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

	test('accepts a key whose public key starts with a zero byte', () => {
		// The keys the old, generated fixture failed on (issue #81): ssh2's generator stripped this byte.
		expect(LEADING_ZERO_HOST_KEY.publicKey[0]).toBe(0);
		const { pem: zero } = LEADING_ZERO_HOST_KEY;
		expect(loadHostKey({ SSH_HOST_KEY: zero }).toString()).toBe(zero.trim());
		expect(loadHostKey({ SSH_HOST_KEY: zero.trim().replace(/\n/g, '\\n') }).toString()).toBe(zero.trim());
	});

	test('fails with a clear message when nothing is configured', () => {
		// Neither set: the default mount, which isn't there in a test.
		expect(() => loadHostKey({})).toThrow(/no host key: .*\/run\/secrets\/ssh_host_key: ENOENT/);
	});

	test('fails clearly when the file is missing', () => {
		expect(() => loadHostKey({ SSH_HOST_KEY_PATH: '/nonexistent/key' })).toThrow(/ENOENT/);
	});

	test('rejects garbage and public keys', () => {
		expect(() => loadHostKey({ SSH_HOST_KEY: 'not a key' })).toThrow(/not a valid private key/);
		expect(() => loadHostKey({ SSH_HOST_KEY: TEST_HOST_KEY.publicLine })).toThrow();
	});
});
