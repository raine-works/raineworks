import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { baseEnvSchema, loadEnvFiles, parseEnv } from '@raineworks/tools/env';

describe('loadEnvFiles', () => {
	const dir = mkdtempSync(join(tmpdir(), 'raineworks-env-'));
	const names = [
		'RAINEWORKS_ENV_TEST_FIRST',
		'RAINEWORKS_ENV_TEST_ONLY_LATER',
		'RAINEWORKS_ENV_TEST_SET',
		'RAINEWORKS_ENV_TEST_FROM_TEST',
		'RAINEWORKS_ENV_TEST_FROM_LOCAL',
	];
	afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
		for (const name of names) delete process.env[name];
	});

	test('loads the files that exist, the earlier winning, never overwriting what is already set', () => {
		writeFileSync(join(dir, '.env.first'), 'RAINEWORKS_ENV_TEST_FIRST=first\nRAINEWORKS_ENV_TEST_SET=from-file\n');
		writeFileSync(join(dir, '.env.later'), 'RAINEWORKS_ENV_TEST_FIRST=later\nRAINEWORKS_ENV_TEST_ONLY_LATER=later\n');
		process.env.RAINEWORKS_ENV_TEST_SET = 'already';
		loadEnvFiles(dir, ['.env.first', '.env.missing', '.env.later']);
		expect(process.env.RAINEWORKS_ENV_TEST_FIRST).toBe('first');
		expect(process.env.RAINEWORKS_ENV_TEST_ONLY_LATER).toBe('later');
		expect(process.env.RAINEWORKS_ENV_TEST_SET).toBe('already');
	});

	test('under NODE_ENV=test it reads .env.test, never .env.local', () => {
		writeFileSync(join(dir, '.env.test'), 'RAINEWORKS_ENV_TEST_FROM_TEST=test\n');
		writeFileSync(join(dir, '.env.local'), 'RAINEWORKS_ENV_TEST_FROM_LOCAL=local\n');
		loadEnvFiles(dir);
		expect(process.env.RAINEWORKS_ENV_TEST_FROM_TEST).toBe('test');
		expect(process.env.RAINEWORKS_ENV_TEST_FROM_LOCAL).toBeUndefined();
	});
});

describe('parseEnv', () => {
	test('reads Bun.env when given nothing, and throws on what the schema refuses', () => {
		expect(parseEnv(baseEnvSchema).NODE_ENV).toBe('test');
		expect(() => parseEnv(baseEnvSchema, { LOG_LEVEL: 'loud' })).toThrow();
		expect(parseEnv(baseEnvSchema, { LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('debug');
	});
});
