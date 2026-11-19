import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	ALLOWED_LICENSES,
	collectNotices,
	COPIED_NOTICES,
	isAllowedLicense,
	LICENSE_OVERRIDES,
	LicenseError,
	packageDirOf,
	STYLE_PACKAGES,
} from '@raineworks/tools/notices';
import { tryCatch } from '@raineworks/tools/prototypes';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'raineworks-notices-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** An installed package under `root`, with the files given; returns a file of it, as a metafile would name one. */
function installed(dir: string, manifest: Record<string, unknown>, files: Record<string, string> = {}): string {
	const packageDir = join(root, dir);
	mkdirSync(packageDir, { recursive: true });
	writeFileSync(join(packageDir, 'package.json'), JSON.stringify(manifest));
	for (const [name, text] of Object.entries(files)) writeFileSync(join(packageDir, name), text);
	return join(packageDir, 'dist/index.js');
}

/** The notices without what every zone has (the style packages, what's copied in). */
const bundled = (inputs: string[], overrides?: Record<string, string>) => {
	const always = new Set<string>([...STYLE_PACKAGES, ...COPIED_NOTICES.map((notice) => notice.name)]);
	return collectNotices(inputs, overrides).filter((notice) => !always.has(notice.name));
};

describe('packageDirOf', () => {
	test('is the innermost installed package above a file, scoped or not', () => {
		expect(packageDirOf('/repo/node_modules/react/cjs/react.js')).toBe('/repo/node_modules/react');
		expect(packageDirOf('/repo/node_modules/@radix-ui/react-slot/dist/index.mjs')).toBe(
			'/repo/node_modules/@radix-ui/react-slot',
		);
		expect(packageDirOf('/repo/node_modules/.bun/a@1.0.0/node_modules/a/node_modules/b/index.js')).toBe(
			'/repo/node_modules/.bun/a@1.0.0/node_modules/a/node_modules/b',
		);
	});

	test('is null for the project’s own files', () => {
		expect(packageDirOf('/repo/packages/ui/src/app/root.tsx')).toBeNull();
	});
});

describe('collectNotices', () => {
	test('lists each package once, by name, with its licence and its licence and notice files', () => {
		const plain = installed(
			'node_modules/plain',
			{ name: 'plain', version: '1.2.3', license: 'MIT' },
			{ LICENSE: 'MIT License\nCopyright (c) Plain\n', 'NOTICE.txt': 'Includes work by others.\n', 'README.md': 'x' },
		);
		const scoped = installed(
			'node_modules/@scope/pkg',
			{ name: '@scope/pkg', version: '0.4.0', license: 'Apache-2.0' },
			{ 'LICENCE.md': 'Apache License 2.0' },
		);
		expect(bundled([scoped, plain, join(root, 'node_modules/plain/dist/other.js'), join(root, 'src/main.ts')])).toEqual(
			[
				{ name: '@scope/pkg', version: '0.4.0', license: 'Apache-2.0', text: 'Apache License 2.0' },
				{
					name: 'plain',
					version: '1.2.3',
					license: 'MIT',
					text: 'MIT License\nCopyright (c) Plain\n\nIncludes work by others.',
				},
			],
		);
	});

	test('two versions of a package are both listed, and one that ships no licence file has no text', () => {
		const outer = installed('node_modules/twice', { name: 'twice', version: '2.0.0', license: 'ISC' });
		const inner = installed(
			'node_modules/host/node_modules/twice',
			{ name: 'twice', version: '1.0.0', license: 'ISC' },
			{ COPYING: 'ISC, earlier' },
		);
		expect(bundled([outer, inner])).toEqual([
			{ name: 'twice', version: '1.0.0', license: 'ISC', text: 'ISC, earlier' },
			{ name: 'twice', version: '2.0.0', license: 'ISC', text: null },
		]);
	});

	test('every zone’s are there whatever it bundles: what the styles are built from, and what’s copied in', () => {
		const notices = collectNotices([]);
		expect(notices.map((notice) => notice.name)).toEqual([
			'@fontsource-variable/geist',
			'@fontsource-variable/geist-mono',
			'shadcn/ui',
			'tailwindcss',
			'tw-animate-css',
		]);
		for (const notice of notices.filter((each) => !each.name.startsWith('@fontsource'))) {
			expect(notice.license).toBe('MIT');
			expect(notice.text).toContain('Permission is hereby granted');
		}
		for (const font of notices.filter((each) => each.name.startsWith('@fontsource'))) {
			expect(font.license).toBe('OFL-1.1');
			expect(font.text).toContain('SIL OPEN FONT LICENSE');
		}
		expect(notices.find((notice) => notice.name === 'shadcn/ui')?.version).toBeNull();
		expect(notices.find((notice) => notice.name === 'tailwindcss')?.version).toMatch(/^\d+\.\d+\.\d+/);
	});

	test('a directory under node_modules that isn’t a package is nobody’s to credit', () => {
		mkdirSync(join(root, 'node_modules/.cache'), { recursive: true });
		expect(bundled([join(root, 'node_modules/.cache/chunk.js')])).toEqual([]);
	});

	test('packages that state no licence fail it, every one named, until an override names theirs', () => {
		const inputs = [
			installed('node_modules/silent', { name: 'silent', version: '1.0.0' }),
			installed('node_modules/closed', { name: 'closed', version: '3.1.0', license: 'UNLICENSED' }),
			installed('node_modules/legacy', { name: 'legacy', version: '0.1.0', license: { type: 'MIT' } }),
			installed('node_modules/blank', { name: 'blank', version: '0.0.1', license: ' ' }),
		];
		const { error } = tryCatch(() => bundled(inputs));
		expect(error).toBeInstanceOf(LicenseError);
		expect((error as LicenseError).packages).toEqual([
			'blank@0.0.1 (no licence stated)',
			'closed@3.1.0 (no licence stated)',
			'legacy@0.1.0 (no licence stated)',
			'silent@1.0.0 (no licence stated)',
		]);
		expect(error?.message).toContain(
			'Not licensed to ship in the MIT-licensed site: blank@0.0.1 (no licence stated), ',
		);
		expect(error?.message).toContain('LICENSE_OVERRIDES');

		const overrides = { silent: 'MIT', closed: 'BSD-3-Clause', legacy: 'MIT', blank: '0BSD' };
		expect(bundled(inputs, overrides).map((notice) => `${notice.name}: ${notice.license}`)).toEqual([
			'blank: 0BSD',
			'closed: BSD-3-Clause',
			'legacy: MIT',
			'silent: MIT',
		]);
	});

	test('nothing is overridden until someone has checked a package', () => {
		expect(LICENSE_OVERRIDES).toEqual({});
	});

	test('a package under a licence the app can’t ship with fails it, stated or overridden, naming the licence', () => {
		const inputs = [
			installed('node_modules/copyleft', { name: 'copyleft', version: '2.0.0', license: 'GPL-3.0-only' }),
			installed('node_modules/weak', { name: 'weak', version: '1.1.0', license: 'LGPL-2.1-or-later' }),
			installed('node_modules/either', { name: 'either', version: '1.0.0', license: '(MIT OR GPL-2.0-only)' }),
			installed('node_modules/unsaid', { name: 'unsaid', version: '0.3.0' }),
		];
		const { error } = tryCatch(() => bundled(inputs, { unsaid: 'AGPL-3.0-only' }));
		expect((error as LicenseError).packages).toEqual([
			'copyleft@2.0.0 (GPL-3.0-only)',
			'unsaid@0.3.0 (AGPL-3.0-only)',
			'weak@1.1.0 (LGPL-2.1-or-later)',
		]);
		expect(error?.message).toContain('ALLOWED_LICENSES');
		// Offered under either, it's taken under the one that's allowed.
		expect(bundled(inputs.slice(2, 3))).toEqual([
			{ name: 'either', version: '1.0.0', license: '(MIT OR GPL-2.0-only)', text: null },
		]);
	});
});

describe('isAllowedLicense', () => {
	test('only permissive licences (and the fonts’ OFL) are allowed: none that puts conditions on the site around it', () => {
		expect(ALLOWED_LICENSES).toEqual(['0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT', 'OFL-1.1']);
		for (const license of ALLOWED_LICENSES) expect(isAllowedLicense(license)).toBe(true);
		for (const license of ['GPL-3.0-only', 'AGPL-3.0-or-later', 'LGPL-3.0-only', 'MPL-2.0', 'SEE LICENSE IN LICENSE'])
			expect(isAllowedLicense(license)).toBe(false);
	});

	test('an expression is allowed when one side of an OR is, and every side of an AND', () => {
		expect(isAllowedLicense('MIT OR Apache-2.0')).toBe(true);
		expect(isAllowedLicense('(GPL-2.0-only OR MIT)')).toBe(true);
		expect(isAllowedLicense('(MIT AND BSD-3-Clause)')).toBe(true);
		expect(isAllowedLicense('MIT AND GPL-3.0-only')).toBe(false);
		expect(isAllowedLicense('(MIT AND GPL-3.0-only) OR ISC')).toBe(true);
		expect(isAllowedLicense('GPL-2.0-only OR LGPL-3.0-only')).toBe(false);
	});

	test('a parenthesised group counts as one, and AND binds tighter than OR', () => {
		// Read without its parentheses, this one would pass on MIT alone.
		expect(isAllowedLicense('(MIT OR Apache-2.0) AND GPL-3.0-only')).toBe(false);
		expect(isAllowedLicense('GPL-3.0-only AND (MIT OR Apache-2.0)')).toBe(false);
		expect(isAllowedLicense('(MIT OR GPL-3.0-only) AND (ISC OR AGPL-3.0-only)')).toBe(true);
		expect(isAllowedLicense('((MIT OR GPL-3.0-only) AND ISC) OR LGPL-3.0-only')).toBe(true);
		expect(isAllowedLicense('GPL-3.0-only OR MIT AND GPL-2.0-only')).toBe(false);
		expect(isAllowedLicense('GPL-3.0-only AND GPL-2.0-only OR MIT')).toBe(true);
	});

	test('what it can’t read as an expression isn’t allowed', () => {
		for (const expression of [
			'',
			'()',
			'(MIT',
			'MIT)',
			'MIT OR',
			'MIT AND',
			'OR MIT',
			'MIT ISC',
			'(MIT OR)',
			'Apache-2.0 WITH LLVM-exception',
		])
			expect(isAllowedLicense(expression)).toBe(false);
	});
});
