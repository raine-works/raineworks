/**
 * The production build of `ssh raineworks.com` (`bun run build`, also its Dockerfile's), for the Bun runtime:
 *
 * 1. `dist/main.js`: the app bundled (minified, names kept: `ssh2` tells its channels apart by `constructor.name`),
 *    OpenTUI's per-platform packages left out (only this platform's is needed, and it's loaded from step 2);
 * 2. `dist/opentui/@opentui/core-<platform>/`: OpenTUI's native library for the platform it's built on, as a file of
 *    its own, found at run time through `OTUI_ASSET_ROOT` (the image sets it). It's under the MIT License and, for
 *    the decode-only FFmpeg it statically links, the LGPL 2.1 or later: kept a separate, replaceable file, with its
 *    licence texts and where FFmpeg's source is beside it;
 * 3. `dist/licenses/`: the licence of every package the app ships, OpenTUI's native library's included.
 *
 * `react-devtools-core` (OpenTUI's opt-in devtools) and `cpu-features` (ssh2's optional native probe; it falls back
 * to pure JS) are stubbed out on purpose: neither is used, and neither should ship.
 *
 * @module scripts/build
 */

import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import '@raineworks/tools/prototypes';

const packageDir = join(import.meta.dir, '..');
const dist = join(packageDir, 'dist');
rmSync(dist, { recursive: true, force: true });

const result = await Bun.build({
	entrypoints: [join(packageDir, 'src/main.ts')],
	outdir: dist,
	naming: { entry: 'main.js' },
	target: 'bun',
	minify: { whitespace: true, syntax: true, identifiers: true, keepNames: true },
	define: { 'process.env.NODE_ENV': '"production"' },
	external: ['@opentui/core-*'],
	metafile: true,
	plugins: [
		{
			name: 'stub-optional-deps',
			setup(build) {
				build.onResolve({ filter: /^(react-devtools-core|cpu-features|ws)$/ }, (args) => ({
					path: args.path,
					namespace: 'stub',
				}));
				build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
			},
		},
	],
});
if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

// This platform's native library, where `OTUI_ASSET_ROOT` points OpenTUI.
const libc = process.platform === 'linux' && Bun.env.OPENTUI_LIBC === 'musl' ? '-musl' : '';
const platformPackage = `@opentui/core-${process.platform}-${process.arch}${libc}`;
// A dependency of `@opentui/core`'s, not this package's: resolved from there (installs are isolated).
const coreDir = dirname(realpathSync(Bun.resolveSync('@opentui/core/package.json', packageDir)));
const nativeDir = dirname(realpathSync(Bun.resolveSync(`${platformPackage}/package.json`, coreDir)));
const nativeOut = join(dist, 'opentui', platformPackage);
mkdirSync(nativeOut, { recursive: true });
for (const file of readdirSync(nativeDir)) {
	if (/^libopentui\.|^LICENSE|^AUTHORS|^PATENTS|-SOURCE\.md$|^package\.json$/.test(file))
		cpSync(join(nativeDir, file), join(nativeOut, file));
}

// Every shipped package's licence, by name: OpenTUI (its native library's notices too), React, ssh2 and the rest the
// bundle is made of.
const licenses = join(dist, 'licenses');
mkdirSync(licenses, { recursive: true });
const inputs = Object.keys(result.metafile?.inputs ?? {});
const packageDirs = new Set(
	[
		...inputs.map((input) => /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(join(process.cwd(), input))?.[1]),
		nativeDir,
	].filter((dir): dir is string => !!dir && existsSync(join(dir, 'package.json'))),
);
for (const dir of packageDirs) {
	const { name } = (await Bun.file(join(dir, 'package.json')).json()) as { name: string };
	const out = join(licenses, name.replace('/', '__'));
	for (const file of readdirSync(dir).filter((each) =>
		/^(licen[sc]e|copying|notice|authors|patents)|-source\.md$/i.test(each),
	)) {
		mkdirSync(out, { recursive: true });
		cpSync(join(dir, file), join(out, file));
	}
}
cpSync(join(packageDir, '../../LICENSE'), join(licenses, 'raineworks.LICENSE'));

console.log(
	`✅ Built dist/main.js, with ${platformPackage}'s native library and ${readdirSync(licenses).length} licences`,
);
