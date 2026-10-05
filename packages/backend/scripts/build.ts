import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cleanBunBuildArtifacts } from '@app/tools/cli';

/**
 * Standalone Binary Compilation Script
 * ----------------------------------------------------------------------------
 * 1. Builds every registered frontend package.
 * 2. Stages each build output under `packages/backend/dist/mfes/<route>`
 *    (root frontend stages to `mfes/__root__`).
 * 3. Compiles `packages/backend/src/index.ts` with `--compile --asset=mfes`
 *    into a single self-contained standalone executable (`dist/server`),
 *    embedding every staged frontend into the binary.
 *
 * To add a new micro-frontend: create `packages/<name>` (same shape as
 * `packages/web`), then add it to the list below AND register its
 * route in `src/index.ts`'s `frontends` array.
 */

console.log('⚡ Compiling standalone binary executable with Bun...');

const packageDir = join(import.meta.dir, '..');
const repoRoot = join(packageDir, '../..');
const backendDist = join(packageDir, 'dist');
const stagedMfesDir = join(backendDist, 'mfes');
const outfile = join(backendDist, 'server');

/** Frontend packages to build and embed. Keep in sync with `src/index.ts`. */
const frontends = [{ name: '@app/web', path: 'packages/web', route: '__root__' }];

cleanBunBuildArtifacts(repoRoot);
cleanBunBuildArtifacts(packageDir);
cleanBunBuildArtifacts(backendDist);

mkdirSync(backendDist, { recursive: true });
if (existsSync(stagedMfesDir)) {
	rmSync(stagedMfesDir, { recursive: true, force: true });
}
mkdirSync(stagedMfesDir, { recursive: true });

for (const frontend of frontends) {
	console.log(`🔨 Building ${frontend.name}...`);
	await Bun.$`bun run --filter ${frontend.name} build`.cwd(repoRoot);

	const frontendDist = join(repoRoot, frontend.path, 'dist');
	const targetDir = join(stagedMfesDir, frontend.route);
	mkdirSync(targetDir, { recursive: true });
	cpSync(frontendDist, targetDir, { recursive: true });
	console.log(`📦 Staged ${frontend.name} -> dist/mfes/${frontend.route}`);
}

await Bun.$`bun build --compile --minify --define Bun.env.NODE_ENV='"production"' --define process.env.NODE_ENV='"production"' --asset=mfes --outfile=server ../src/index.ts`.cwd(
	backendDist,
);

cleanBunBuildArtifacts(backendDist);
cleanBunBuildArtifacts(packageDir);
cleanBunBuildArtifacts(repoRoot);

console.log(`✅ Standalone binary executable successfully created: ${outfile}`);
