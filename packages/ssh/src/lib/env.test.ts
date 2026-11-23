import { describe, expect, test } from 'bun:test';

import { envSchema } from '@raineworks/ssh/lib/env';
import { loadHostKey } from '@raineworks/ssh/server';
import { utils } from 'ssh2';

const { private: pem } = utils.generateKeyPairSync('ed25519');

describe('envSchema host key settings', () => {
	test('keeps SSH_HOST_KEY and SSH_HOST_KEY_PATH', () => {
		const env = envSchema.parse({ SSH_HOST_KEY: 'key', SSH_HOST_KEY_PATH: '/keys/host' });
		expect(env.SSH_HOST_KEY).toBe('key');
		expect(env.SSH_HOST_KEY_PATH).toBe('/keys/host');
	});

	test('leaves both unset when missing', () => {
		const env = envSchema.parse({});
		expect(env.SSH_HOST_KEY).toBeUndefined();
		expect(env.SSH_HOST_KEY_PATH).toBeUndefined();
	});

	test('the parsed settings load the host key', () => {
		expect(loadHostKey(envSchema.parse({ SSH_HOST_KEY: pem })).toString()).toBe(pem.trim());
	});

	test('the parsed settings report a missing key file', () => {
		expect(() => loadHostKey(envSchema.parse({ SSH_HOST_KEY_PATH: '/nonexistent/key' }))).toThrow(
			/no host key: .*\/nonexistent\/key: ENOENT/,
		);
	});
});
