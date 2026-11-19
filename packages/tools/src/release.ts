/**
 * Releases (`bun run release`): raineworks’ calendar versions (`@raineworks/tools/calver`)
 * and their notes (`packages/ui/src/release-notes/<version>.md`).
 *
 * The command (`bun run release`) is `@raineworks/tools/release-cli`.
 *
 * Every push to master that changes an image is a release (`.github/workflows/ci.yml`): it takes `next`, tags
 * `v<version>` and publishes the GitHub release, from its note if one was written (`notes`), else from the pull
 * requests merged since the last. Notes are optional: the Release note workflow (`release.yml`) has Claude write one.
 *
 * @module release
 */

import { compareVersions, isVersion, nextVersion } from '@raineworks/tools/calver';
import { splitFrontmatter, splitScopes } from '@raineworks/tools/markdown';
import { latestVersion } from '@raineworks/tools/version';
import { ZONES } from '@raineworks/tools/zones';
import '@raineworks/tools/prototypes';

/** How a release's GitHub text heads each zone's part: its title (`@raineworks/tools/zones`). */
const ZONE_NAMES: Record<string, string> = Object.fromEntries(
	Object.entries(ZONES).map(([zone, { title }]) => [zone, title]),
);

/** The newest `v<version>` tag in this clone, or `null` (CI fetches every tag). */
export function latestTag(): string | null {
	const git = Bun.spawnSync(['git', 'tag', '--list', 'v*'], { stderr: 'ignore' });
	if (!git.success) return null;
	const versions = git.stdout
		.toString()
		.split('\n')
		.map((tag) => tag.trim().slice(1))
		.filter(isVersion);
	return versions.sort(compareVersions).at(-1) ?? null;
}

/**
 * The version a release takes, from the newest tag and the newest note: a note ahead of the tag was written for this
 * release, so it names it; otherwise it's the one after the tag (this month's next number, else `.1`).
 */
export function releaseVersion(
	tagged: string | null,
	noted: string | null,
	today: { year: number; month: number },
): string {
	if (noted && (!tagged || compareVersions(noted, tagged) > 0)) return noted;
	return nextVersion(tagged, today);
}

/** The notes among `added` that name a version already taken (not after the newest tag). */
export function staleNotes(tagged: string | null, added: string[]): string[] {
	return tagged ? added.filter((version) => compareVersions(version, tagged) <= 0) : [];
}

/** The next version, as of today (UTC). */
export function upcomingVersion(): string {
	const today = Temporal.Now.plainDateISO('UTC');
	return releaseVersion(latestTag(), latestVersion(), { year: today.year, month: today.month });
}

/** A note as a GitHub release's text: its title, then each part, the zone-scoped ones under who they're for. */
export function releaseText(source: string): string {
	const { meta, body } = splitFrontmatter(source);
	const parts = splitScopes(body).map(({ zones, markdown }) => {
		if (!zones) return markdown.trim();
		const who = zones.map((zone) => ZONE_NAMES[zone] ?? zone).join(', ');
		// Its headings one level down, under who it's for.
		return `## For ${who}\n\n${markdown.trim().replace(/^(#{2,5}) /gm, '#$1 ')}`;
	});
	return [meta.title ? `**${meta.title}**` : '', ...parts].filter(Boolean).join('\n\n').concat('\n');
}
