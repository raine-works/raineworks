/**
 * `bun run release`: the command line for releases (`@raineworks/tools/release`).
 *
 * ```
 * bun run release                 starts the next version's note (a stub to fill in), and says what's next
 * bun run release next            prints the next version: a note written ahead of the newest tag, else the one after it
 * bun run release check           fails if a note added since the newest tag isn't ahead of it (it names a version taken)
 * bun run release notes <version> prints a note as a GitHub release's text (its zone parts as headings)
 * bun run release tag <version>   tags HEAD v<version> (annotated)
 * ```
 *
 * Only ever run as a process's entry point (CI, the Release note workflow, by hand), so Bun's coverage can't count
 * it: `release.test.ts` runs it in a throwaway repository, and the package's `bunfig.toml` excludes this file by name.
 *
 * @module release-cli
 */

import { join } from 'node:path';

import { isVersion } from '@raineworks/tools/calver';
import { latestTag, releaseText, staleNotes, upcomingVersion } from '@raineworks/tools/release';
import { RELEASE_NOTES_DIR } from '@raineworks/tools/version';
import { ZONE_IDS } from '@raineworks/tools/zones';
import '@raineworks/tools/prototypes';

/** Git's empty tree: what a diff starts from before the first tag. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const noteFile = (version: string) => join(RELEASE_NOTES_DIR, `${version}.md`);

const STUB = (date: string) => `---
title: <What this release is about, in a few words>
date: ${date}
---

::: for admin
## <A change only admin sees>

- …
:::
`;

if (import.meta.main) {
	const [command, argument] = process.argv.slice(2);
	if (command === 'next') {
		console.log(upcomingVersion());
	} else if (command === 'notes') {
		if (!argument || !isVersion(argument)) throw new Error('Usage: bun run release notes <version>');
		process.stdout.write(releaseText(await Bun.file(noteFile(argument)).text()));
	} else if (command === 'check') {
		const tagged = latestTag();
		const diff = Bun.spawnSync(
			[
				'git',
				'diff',
				'--name-only',
				'--diff-filter=A',
				tagged ? `v${tagged}` : EMPTY_TREE,
				'HEAD',
				'--',
				RELEASE_NOTES_DIR,
			],
			{ stderr: 'inherit' },
		);
		if (!diff.success) process.exit(1);
		const added = diff.stdout
			.toString()
			.split('\n')
			.map((path) => path.split('/').at(-1)?.replace(/\.md$/, '') ?? '')
			.filter(isVersion);
		const stale = staleNotes(tagged, added);
		if (!stale.isEmpty()) {
			console.error(
				`v${tagged} is already released, so these notes name versions taken: ${stale.join(', ')}. Rename each to ${upcomingVersion()} (bun run release next).`,
			);
			process.exit(1);
		}
	} else if (command === 'tag') {
		if (!argument || !isVersion(argument)) throw new Error('Usage: bun run release tag <version>');
		const tag = Bun.spawnSync(['git', 'tag', '-a', `v${argument}`, '-m', `raineworks ${argument}`], {
			stdio: ['inherit', 'inherit', 'inherit'],
		});
		if (!tag.success) process.exit(1);
		console.log(`Tagged v${argument}. Push it with: git push origin v${argument}`);
	} else if (!command) {
		const version = upcomingVersion();
		const file = noteFile(version);
		if (await Bun.file(file).exists()) {
			console.log(`${version}'s note is already at ${file}.`);
		} else {
			await Bun.write(file, STUB(Temporal.Now.plainDateISO('UTC').toString()));
			console.log(`Started ${version}'s note at ${file}.`);
			console.log(
				`Write what changed for the people who use raineworks, not how. Scope each part to the zones it affects with "::: for ${ZONE_IDS.join(', ')}" … ":::" (zones: ${ZONE_IDS.join(', ')}); anything outside one is shown everywhere.`,
			);
			console.log('Merge it into master in the pull request it describes: that merge is released as this version.');
		}
	} else {
		throw new Error(`Unknown command: ${command}`);
	}
}
