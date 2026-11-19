/**
 * raineworks’ releases are versioned by the calendar: `YEAR.MONTH.N`, e.g.
 * `2026.11.1` for November 2026's first release, `2026.11.2` its second, and
 * `2026.12.1` the first in December. Each is tagged `v<version>` in git and has
 * a release note named by it (`packages/ui/src/release-notes/<version>.md`):
 * the newest note is the version being built.
 *
 * Builds stamp the version and the commit they were built from into every
 * zone (`buildInfo`, `@raineworks/tools/build`), which every page shows. Build-time
 * only (it reads the filesystem and git): pages use `@raineworks/tools/calver`.
 *
 * @module version
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { buildEnv } from '@raineworks/tools/build-env';
import { compareVersions, isVersion } from '@raineworks/tools/calver';
import { tryCatch } from '@raineworks/tools/prototypes';

export { compareVersions, isVersion, nextVersion } from '@raineworks/tools/calver';

/** Where release notes live: one Markdown file per version. */
export const RELEASE_NOTES_DIR = join(import.meta.dir, '../../ui/src/release-notes');

/** The newest version with a release note in `dir`, or `null`. */
export function latestVersion(dir = RELEASE_NOTES_DIR): string | null {
	const { data: names } = tryCatch(() => readdirSync(dir));
	if (!names) return null;
	const versions = names.map((name) => name.replace(/\.md$/, '')).filter(isVersion);
	return versions.sort(compareVersions).at(-1) ?? null;
}

/** The commit being built, short: `RAINEWORKS_COMMIT` (CI, a Docker build without `.git`), else git's, else `unknown`. */
function currentCommit(): string {
	const { RAINEWORKS_COMMIT } = buildEnv();
	if (RAINEWORKS_COMMIT) return RAINEWORKS_COMMIT.slice(0, 7);
	// No git at all (an image's build without `GIT_SHA`) is as unknown as no repository.
	const { data: git } = tryCatch(() => Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], { stderr: 'ignore' }));
	return git?.success ? git.stdout.toString().trim() : 'unknown';
}

/** What a build stamps: its version (`RAINEWORKS_VERSION`, else the newest release note's) and commit. */
export function buildInfo(): { version: string; commit: string } {
	return { version: buildEnv().RAINEWORKS_VERSION ?? (latestVersion() || '0.0.0'), commit: currentCommit() };
}
