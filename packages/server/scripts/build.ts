/**
 * Production build of `@raineworks/server` (`bun run build`, also the Dockerfile's):
 *
 * 1. builds every web zone (`bun run build:web`: minified, precompressed);
 * 2. copies each zone's `dist/` (no source maps) to `dist/web/<zone>/`;
 * 3. compiles `src/main.ts` into the standalone binary `dist/server`, with
 *    `web/` embedded (`--asset=web`), which `lib/spa` serves from
 *    `Bun.embeddedFiles`.
 *
 * ```bash
 * bun run build                                    # → packages/server/dist/server
 * bun packages/server/scripts/build.ts --skip-web  # reuse the zones already built
 * ```
 *
 * `dist/web` stays behind, so `WEB_DIST=packages/server/dist/web bun run start`
 * serves the same files without the binary.
 *
 * @module scripts/build
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { cleanBunBuildArtifacts } from '@raineworks/tools/cli';
import { ZONE_IDS, ZONES } from '@raineworks/tools/zones';

const serverDir = join(import.meta.dir, '..');
const rootDir = join(serverDir, '../..');
const distDir = join(serverDir, 'dist');
const outfile = join(distDir, 'server');

if (!process.argv.includes('--skip-web')) {
	console.log('⚡ Building the web zones...');
	const web = Bun.spawnSync(['bun', 'run', 'build:web'], { cwd: rootDir, stdout: 'inherit', stderr: 'inherit' });
	if (web.exitCode !== 0) process.exit(web.exitCode ?? 1);
}

rmSync(distDir, { recursive: true, force: true });
for (const zone of ZONE_IDS) {
	const from = join(rootDir, 'packages', ZONES[zone].package, 'dist');
	if (!existsSync(join(from, 'index.html'))) {
		console.error(`❌ ${ZONES[zone].package} has no build (${from}). Run \`bun run build:web\` first.`);
		process.exit(1);
	}
	cpSync(from, join(distDir, 'web', zone), { recursive: true, filter: (path) => !path.endsWith('.map') });
}

// `--asset` paths are embedded relative to the working directory: `web/<zone>/<file>`.
mkdirSync(distDir, { recursive: true });
process.chdir(distDir);
console.log('⚡ Compiling the server...');
const result = await Bun.build({
	entrypoints: [join(serverDir, 'src/main.ts')],
	compile: { outfile, assets: ['web'] },
	minify: true,
	define: { 'process.env.NODE_ENV': '"production"', 'Bun.env.NODE_ENV': '"production"' },
});
cleanBunBuildArtifacts(distDir);

if (!result.success) {
	console.error('❌ Server build failed:');
	for (const log of result.logs) console.error(log);
	process.exit(1);
}
console.log(`✅ Built ${outfile} (${(Bun.file(outfile).size / 1024 / 1024).toFixed(1)} MB)`);
