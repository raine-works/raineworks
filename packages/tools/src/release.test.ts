import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { latestTag, releaseText, releaseVersion, staleNotes, upcomingVersion } from '@raineworks/tools/release';
import { latestVersion, RELEASE_NOTES_DIR } from '@raineworks/tools/version';

describe('a release note as a GitHub release', () => {
	test('its zone parts go under who they are for, their headings a level down', () => {
		const note = `---
title: Teams
date: 2026-11-05
---

::: for marketing, elsewhere
## Teams

- Group your people.
:::

## Everywhere

- Faster pages.
`;
		expect(releaseText(note)).toBe(
			'**Teams**\n\n## For raineworks, elsewhere\n\n### Teams\n\n- Group your people.\n\n## Everywhere\n\n- Faster pages.\n',
		);
	});
});

describe('the version a release takes', () => {
	const today = { year: 2026, month: 11 };

	test('the one after the newest tag, this month', () => {
		expect(releaseVersion('2026.11.3', '2026.11.1', today)).toBe('2026.11.4');
		expect(releaseVersion('2026.10.7', null, today)).toBe('2026.11.1');
		expect(releaseVersion(null, null, today)).toBe('2026.11.1');
	});

	test('a note written ahead of the newest tag names it', () => {
		expect(releaseVersion('2026.11.3', '2026.11.4', today)).toBe('2026.11.4');
		expect(releaseVersion(null, '2026.11.1', today)).toBe('2026.11.1');
	});

	test('a note without a title, or with a zone it does not know, still reads', () => {
		expect(releaseText('::: for mystery\n## Hidden\n:::\n')).toBe('## For mystery\n\n### Hidden\n');
		expect(releaseText('Just text.')).toBe('Just text.\n');
	});

	test('a note added for a version already tagged is stale', () => {
		expect(staleNotes('2026.11.4', ['2026.11.4', '2026.11.5', '2026.11.2'])).toEqual(['2026.11.4', '2026.11.2']);
		expect(staleNotes(null, ['2026.11.1'])).toEqual([]);
	});
});

describe('releases in a repository', () => {
	// A throwaway repository, never this one: its tags are what the release reads and makes.
	const repo = mkdtempSync(join(tmpdir(), 'raineworks-release-'));
	const outside = mkdtempSync(join(tmpdir(), 'raineworks-release-outside-'));
	const cwd = process.cwd();
	const today = Temporal.Now.plainDateISO('UTC');
	const thisMonth = `${today.year}.${today.month}`;
	// Who commits and tags there, so it works where git has no identity set (CI).
	const env = {
		...Bun.env,
		GIT_AUTHOR_NAME: 'Test',
		GIT_AUTHOR_EMAIL: 'test@example.com',
		GIT_COMMITTER_NAME: 'Test',
		GIT_COMMITTER_EMAIL: 'test@example.com',
	};
	const git = (...args: string[]) => Bun.spawnSync(['git', ...args], { cwd: repo, env });
	const release = (...args: string[]) =>
		Bun.spawnSync([process.execPath, join(import.meta.dir, 'release-cli.ts'), ...args], { cwd: repo, env });

	beforeAll(() => {
		git('init', '-q');
		git('commit', '-q', '--allow-empty', '-m', 'start');
	});
	afterEach(() => process.chdir(cwd));
	afterAll(() => {
		rmSync(repo, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	});

	test('no tags, or no repository, is no tag', () => {
		process.chdir(repo);
		expect(latestTag()).toBeNull();
		process.chdir(outside);
		expect(latestTag()).toBeNull();
	});

	test('the newest tag is the newest version, by version, ignoring other tags', () => {
		for (const tag of ['v2026.9.3', 'v2026.11.2', 'v2026.11.10', 'other', 'v1']) git('tag', tag);
		process.chdir(repo);
		expect(latestTag()).toBe('2026.11.10');
	});

	test('the upcoming version is the one after the newest tag when no note is ahead of it', () => {
		git('tag', `v${thisMonth}.900`);
		process.chdir(repo);
		expect(upcomingVersion()).toBe(`${thisMonth}.901`);
	});

	test('`release next` prints it; `release tag` tags HEAD with it, annotated', () => {
		const next = release('next');
		expect(next.stdout.toString()).toBe(`${thisMonth}.901\n`);
		const tagged = release('tag', `${thisMonth}.901`);
		expect(tagged.exitCode).toBe(0);
		expect(tagged.stdout.toString()).toContain(`Tagged v${thisMonth}.901.`);
		expect(git('cat-file', '-t', `v${thisMonth}.901`).stdout.toString().trim()).toBe('tag');
		expect(release('tag', `${thisMonth}.901`).exitCode).not.toBe(0);
	});

	test("`release notes` prints a note as a GitHub release's text", async () => {
		const version = latestVersion();
		if (!version) return;
		const notes = release('notes', version);
		expect(notes.exitCode).toBe(0);
		expect(notes.stdout.toString()).toBe(releaseText(await Bun.file(join(RELEASE_NOTES_DIR, `${version}.md`)).text()));
	});

	test('a command it does not know, or a version that is not one, is refused', () => {
		for (const args of [['notes'], ['notes', 'latest'], ['tag', 'v1'], ['publish']]) {
			const run = release(...args);
			expect({ args, failed: run.exitCode !== 0 }).toEqual({ args, failed: true });
		}
		expect(release('publish').stderr.toString()).toContain('Unknown command: publish');
		expect(release('tag').stderr.toString()).toContain('Usage: bun run release tag <version>');
	});
});
