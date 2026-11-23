import { describe, expect, test } from 'bun:test';

import { buildEnv } from '@raineworks/tools/build-env';

describe('a build’s settings', () => {
	test('reads the version and commit it’s given, trimmed', () => {
		expect(
			buildEnv({ NODE_ENV: 'production', RAINEWORKS_VERSION: ' 2030.1.2 ', RAINEWORKS_COMMIT: 'abcdef0123' }),
		).toEqual({
			NODE_ENV: 'production',
			RAINEWORKS_VERSION: '2030.1.2',
			RAINEWORKS_COMMIT: 'abcdef0123',
		});
	});

	test('a blank version or commit (an image built without them) is unset, and NODE_ENV defaults to development', () => {
		expect(buildEnv({ RAINEWORKS_VERSION: '', RAINEWORKS_COMMIT: '  ' })).toEqual({
			NODE_ENV: 'development',
			RAINEWORKS_VERSION: undefined,
			RAINEWORKS_COMMIT: undefined,
		});
	});

	test('reads the process’s environment when given nothing, and refuses an unknown NODE_ENV', () => {
		expect(buildEnv().NODE_ENV).toBe('test');
		expect(() => buildEnv({ NODE_ENV: 'staging' })).toThrow();
	});

	test('reads which libc’s OpenTUI library to ship, unset by default, and refuses any other', () => {
		expect(buildEnv({}).OPENTUI_LIBC).toBeUndefined();
		expect(buildEnv({ OPENTUI_LIBC: 'musl' }).OPENTUI_LIBC).toBe('musl');
		expect(buildEnv({ OPENTUI_LIBC: 'glibc' }).OPENTUI_LIBC).toBe('glibc');
		expect(() => buildEnv({ OPENTUI_LIBC: 'uclibc' })).toThrow();
	});
});
