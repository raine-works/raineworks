import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { countsAsInput, imageSuffix, inputsHash, packagesOf, plan, servicesAt } from '@raineworks/tools/images';
import '@raineworks/tools/prototypes';

const ROOT = join(import.meta.dir, '../../..');

describe('what an image is built from', () => {
	test('every package declares the @raineworks packages it imports, so an image never misses one', async () => {
		const undeclared: string[] = [];
		for (const manifestPath of new Bun.Glob('packages/*/package.json').scanSync({ cwd: ROOT })) {
			const name = manifestPath.split('/')[1] ?? '';
			const manifest = await Bun.file(join(ROOT, manifestPath)).json();
			const declared = Object.keys({
				...manifest.dependencies,
				...manifest.devDependencies,
				...manifest.peerDependencies,
			});
			for (const file of new Bun.Glob(`packages/${name}/{src,scripts}/**/*.{ts,tsx}`).scanSync({ cwd: ROOT })) {
				const source = await Bun.file(join(ROOT, file)).text();
				const imported = [...source.matchAll(/(?:from|import)\s*\(?\s*['"](@raineworks\/[a-z0-9-]+)/g)].map(
					(match) => match[1],
				);
				for (const pkg of imported.unique()) {
					if (pkg && pkg !== `@raineworks/${name}` && !declared.includes(pkg))
						undeclared.push(`${file} imports ${pkg}`);
				}
			}
		}
		expect(undeclared).toEqual([]);
	});

	test('a service is built from its dependencies, through theirs, and the server from every zone too', () => {
		const deps: Record<string, string[]> = {
			api: ['tools'],
			tools: [],
			server: ['tools'],
			'web-marketing': ['ui', 'tools'],
			ui: ['api', 'tools'],
		};
		const packages = Object.keys(deps);
		const of = (name: string) => deps[name] ?? [];
		expect(packagesOf('api', packages, of)).toEqual(['api', 'tools']);
		expect(packagesOf('server', packages, of)).toEqual(['api', 'server', 'tools', 'ui', 'web-marketing']);
	});

	test('a package’s build runs its scripts/build.ts and no other script, the only one an image is built from', async () => {
		const others: string[] = [];
		for (const manifestPath of new Bun.Glob('packages/*/package.json').scanSync({ cwd: ROOT })) {
			const build: string = (await Bun.file(join(ROOT, manifestPath)).json()).scripts?.build ?? '';
			for (const [script] of build.matchAll(/scripts\/[\w.-]+/g))
				if (script !== 'scripts/build.ts') others.push(`${manifestPath}: ${script}`);
		}
		expect(others).toEqual([]);
	});

	test('tests and docs never change an image; the Markdown zones are built from does', () => {
		expect(countsAsInput('packages/server/src/app.ts')).toBe(true);
		expect(countsAsInput('packages/server/Dockerfile')).toBe(true);
		expect(countsAsInput('packages/server/src/app.test.ts')).toBe(false);
		expect(countsAsInput('packages/ui/src/blocks/x.test.tsx')).toBe(false);
		expect(countsAsInput('packages/server/README.md')).toBe(false);
		expect(countsAsInput('packages/ui/src/release-notes/2026.11.1.md')).toBe(true);
		expect(countsAsInput('packages/web-marketing/src/docs/guide.md')).toBe(false);
		expect(countsAsInput('packages/server/scripts/build.ts')).toBe(true);
		expect(countsAsInput('packages/ui/scripts/brand-assets.tsx')).toBe(false);
		expect(countsAsInput('packages/server/scripts/openapi.ts')).toBe(false);
		expect(countsAsInput('packages/ui/src/assets/apple-touch-icon.png')).toBe(true);
	});

	test('the hash is of the inputs alone', () => {
		const lock = { path: 'bun.lock', blob: 'a' };
		const files = [
			lock,
			{ path: 'packages/worker/src/index.ts', blob: 'b' },
			{ path: 'packages/server/src/app.ts', blob: 'c' },
		];
		const hash = inputsHash(files, ['worker']);
		expect(hash).toMatch(/^[0-9a-f]{20}$/);
		expect(inputsHash([...files].reverse(), ['worker'])).toBe(hash);
		// Another package's change, a test or a README isn't the worker's.
		expect(inputsHash([...files.slice(0, 2), { path: 'packages/server/src/app.ts', blob: 'd' }], ['worker'])).toBe(
			hash,
		);
		expect(inputsHash([...files, { path: 'packages/worker/src/index.test.ts', blob: 'e' }], ['worker'])).toBe(hash);
		expect(inputsHash([...files, { path: 'packages/worker/README.md', blob: 'f' }], ['worker'])).toBe(hash);
		// Its own source, the lockfile, or a file's path is.
		expect(inputsHash([lock, { path: 'packages/worker/src/index.ts', blob: 'g' }], ['worker'])).not.toBe(hash);
		expect(inputsHash([{ path: 'bun.lock', blob: 'h' }, ...files.slice(1)], ['worker'])).not.toBe(hash);
		expect(inputsHash([lock, { path: 'packages/worker/src/main.ts', blob: 'b' }], ['worker'])).not.toBe(hash);
	});

	test('every package with a Dockerfile is a service', () => {
		const services = servicesAt('HEAD').map(({ service }) => service);
		expect(services).toEqual(['server', 'ssh']);
	});

	test('the server’s image is named after the repository, every other service’s after it and its own name', () => {
		expect(imageSuffix('server')).toBe('');
		expect(imageSuffix('ssh')).toBe('-ssh');
		expect(plan().services.map(({ suffix }) => suffix)).toEqual(['', '-ssh']);
	});

	test('the plan builds every service with nothing to compare, and none whose inputs match', () => {
		const fresh = plan();
		expect(fresh.changed).toEqual(['server', 'ssh']);
		expect(fresh.services.every(({ changed }) => changed)).toBe(true);
		const same = plan('HEAD');
		expect(same.changed).toEqual([]);
		expect(same.services.map(({ inputs }) => inputs)).toEqual(fresh.services.map(({ inputs }) => inputs));
	});

	test('the images command prints the plan, and refuses anything else', () => {
		const script = join(import.meta.dir, 'images-cli.ts');
		const run = Bun.spawnSync([process.execPath, script, 'plan', '--since', 'HEAD'], { cwd: ROOT });
		expect(run.exitCode).toBe(0);
		expect(JSON.parse(run.stdout.toString())).toEqual(plan('HEAD'));
		const wrong = Bun.spawnSync([process.execPath, script, 'build'], { cwd: ROOT });
		expect(wrong.exitCode).not.toBe(0);
		expect(wrong.stderr.toString()).toContain('Usage: bun run images plan');
	});
});
