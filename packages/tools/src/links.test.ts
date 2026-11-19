import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');

/** A link's `href` that stays on the site or opens the mail app: those open in place. */
const IN_PLACE = /^\{?['"`]?(\/|#|mailto:)/;

describe('links', () => {
	test('every link in the web zones and their UI opens off-site pages in a new tab', async () => {
		const missing: string[] = [];
		for (const file of new Bun.Glob('packages/{ui,web-*}/src/**/*.tsx').scanSync({ cwd: ROOT })) {
			if (file.endsWith('.test.tsx')) continue;
			const source = await Bun.file(join(ROOT, file)).text();
			for (const match of source.matchAll(/<a\b[\s\S]*?>/g)) {
				const tag = match[0];
				const href = /\bhref=(\{[^}]*\}|"[^"]*")/.exec(tag)?.[1] ?? '';
				if (IN_PLACE.test(href) || /\btarget\b/.test(tag)) continue;
				const line = source.slice(0, match.index).split('\n').length;
				missing.push(`${file}:${line} ${href}`);
			}
		}
		// Give each a `target="_blank" rel="noopener noreferrer"` (a `mailto:` or one of the site's own paths opens in
		// place); rendered Markdown does this itself (`markdown.ts`).
		expect(missing).toEqual([]);
	});
});
