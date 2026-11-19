import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compareVersions, isVersion, nextVersion } from '@raineworks/tools/calver';
import { buildInfo, latestVersion, RELEASE_NOTES_DIR } from '@raineworks/tools/version';

describe('calendar versions', () => {
	test('the next counts up within a month and starts again in the next', () => {
		expect(nextVersion('2026.11.1', { year: 2026, month: 11 })).toBe('2026.11.2');
		expect(nextVersion('2026.11.9', { year: 2026, month: 12 })).toBe('2026.12.1');
		expect(nextVersion(null, { year: 2026, month: 11 })).toBe('2026.11.1');
	});

	test('compare by year, month, then count, as numbers', () => {
		expect(['2026.11.10', '2026.9.3', '2026.11.2', '2025.12.1'].sort(compareVersions)).toEqual([
			'2025.12.1',
			'2026.9.3',
			'2026.11.2',
			'2026.11.10',
		]);
		expect(isVersion('2026.11.1')).toBe(true);
		expect(isVersion('v2026.11.1')).toBe(false);
	});
});

describe('the version being built', () => {
	const dir = mkdtempSync(join(tmpdir(), 'raineworks-version-'));
	const saved = { ...Bun.env };
	const cwd = process.cwd();
	afterEach(() => {
		for (const name of ['RAINEWORKS_VERSION', 'RAINEWORKS_COMMIT']) {
			if (saved[name] === undefined) delete process.env[name];
			else process.env[name] = saved[name];
		}
		process.chdir(cwd);
	});
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	test('is the newest release note, by version, not by name', () => {
		const notes = join(dir, 'notes');
		mkdirSync(notes);
		for (const name of ['2026.9.3.md', '2026.11.2.md', '2026.11.10.md', 'README.md', 'draft.md']) {
			writeFileSync(join(notes, name), '');
		}
		expect(latestVersion(notes)).toBe('2026.11.10');
	});

	test('is null with no notes, or no directory', () => {
		const empty = join(dir, 'empty');
		mkdirSync(empty);
		writeFileSync(join(empty, 'README.md'), '');
		expect(latestVersion(empty)).toBeNull();
		expect(latestVersion(join(dir, 'missing'))).toBeNull();
	});

	test("is RAINEWORKS_VERSION when set, else the project's newest note, with RAINEWORKS_COMMIT's short commit", () => {
		process.env.RAINEWORKS_VERSION = '2030.1.1';
		process.env.RAINEWORKS_COMMIT = '0123456789abcdef';
		expect(buildInfo()).toEqual({ version: '2030.1.1', commit: '0123456' });
		delete process.env.RAINEWORKS_VERSION;
		expect(buildInfo().version).toBe(latestVersion(RELEASE_NOTES_DIR) ?? '0.0.0');
	});

	test("without RAINEWORKS_COMMIT, is git's commit, else unknown", () => {
		delete process.env.RAINEWORKS_COMMIT;
		const head = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']).stdout.toString().trim();
		expect(buildInfo().commit).toBe(head);
		// Outside a repository.
		process.chdir(dir);
		expect(buildInfo().commit).toBe('unknown');
	});
});
