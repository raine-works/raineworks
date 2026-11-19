/**
 * What each service's image is built from (`bun run images`), so CI builds an
 * image only when that has changed (`.github/workflows/ci.yml`).
 *
 * A service is a package with a `Dockerfile`. Its image's inputs are the files
 * its build can read that change what it builds: the root's install and build
 * settings, and every package it depends on (`@raineworks/*` in each `package.json`,
 * which declares every import: `images.test.ts`), the server's with every web
 * zone it embeds. Tests and Markdown don't count, but for the Markdown the
 * zones are built from (as `.dockerignore`). Their hash is of git's blob ids,
 * so it's of their content, at any commit, and names the image built from them
 * (`inputs-<hash>`): an image whose inputs are already in the registry is only
 * tagged, never built again.
 *
 * ```
 * bun run images plan [--since <ref>]   JSON: each service, its inputs' hash, and whether that changed since <ref>
 * ```
 *
 * The command is `@raineworks/tools/images-cli`.
 *
 * @module images
 */

import '@raineworks/tools/prototypes';

/** The root's files every image is built with. */
const ROOT_INPUTS = ['.dockerignore', 'bun.lock', 'bunfig.toml', 'package.json', 'tsconfig.json'];

/** The Markdown builds read: release notes (every zone). Add a zone's own here if its build reads Markdown. */
const BUILT_MARKDOWN = [/^packages\/ui\/src\/release-notes\/[^/]+\.md$/];

/** Characters of the hash kept in the image's tag. */
const HASH_LENGTH = 20;

/** Whether a file in a service's packages changes what its image builds. */
export function countsAsInput(path: string): boolean {
	if (/\.test\.tsx?$/.test(path)) return false;
	if (path.endsWith('.md')) return BUILT_MARKDOWN.some((pattern) => pattern.test(path));
	return true;
}

/**
 * The packages a service's image is built from: it and every `@raineworks/*` package it depends on, through theirs. The
 * server embeds every web zone (`scripts/build.ts`), so it's built from them too.
 */
export function packagesOf(service: string, packages: string[], dependencies: (name: string) => string[]): string[] {
	const roots = service === 'server' ? [service, ...packages.filter((name) => name.startsWith('web-'))] : [service];
	const found = new Set<string>();
	const visit = (name: string) => {
		if (found.has(name) || !packages.includes(name)) return;
		found.add(name);
		for (const dependency of dependencies(name)) visit(dependency);
	};
	for (const root of roots) visit(root);
	return [...found].sort();
}

/** A tracked file, as `git ls-tree` lists it. */
export interface TreeFile {
	path: string;
	blob: string;
}

/** The hash of a service's inputs among `files`: the root's, and those in its packages that count. */
export function inputsHash(files: TreeFile[], packages: string[]): string {
	const inPackages = (path: string) => packages.some((name) => path.startsWith(`packages/${name}/`));
	const lines = files
		.filter(({ path }) => ROOT_INPUTS.includes(path) || (inPackages(path) && countsAsInput(path)))
		.map(({ path, blob }) => `${blob} ${path}`)
		.sort();
	return new Bun.CryptoHasher('sha256').update(lines.join('\n')).digest('hex').slice(0, HASH_LENGTH);
}

function git(...args: string[]): string {
	const result = Bun.spawnSync(['git', ...args], { stderr: 'pipe' });
	if (!result.success) throw new Error(`git ${args.join(' ')}: ${result.stderr.toString().trim()}`);
	return result.stdout.toString();
}

/** Each service at a commit, and its inputs' hash. */
export function servicesAt(ref: string): { service: string; inputs: string }[] {
	const files = git('ls-tree', '-r', '--full-tree', ref)
		.split('\n')
		.filter(Boolean)
		.map((line): TreeFile => {
			const [meta = '', path = ''] = line.split('\t');
			return { path, blob: meta.split(' ')[2] ?? '' };
		});
	const packages = files
		.map(({ path }) => /^packages\/([^/]+)\/package\.json$/.exec(path)?.[1])
		.filter((name): name is string => !!name);
	const dependencies = (name: string) => {
		const manifest = JSON.parse(git('show', `${ref}:packages/${name}/package.json`)) as Record<
			string,
			Record<string, string> | undefined
		>;
		return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies })
			.filter((key) => key.startsWith('@raineworks/'))
			.map((key) => key.slice('@raineworks/'.length));
	};
	return packages
		.filter((name) => files.some(({ path }) => path === `packages/${name}/Dockerfile`))
		.map((service) => ({ service, inputs: inputsHash(files, packagesOf(service, packages, dependencies)) }));
}

/** Each service at `HEAD`, and whether its inputs changed since `since` (every one, with nothing to compare). */
export function plan(since?: string) {
	const before = new Map((since ? servicesAt(since) : []).map(({ service, inputs }) => [service, inputs]));
	const services = servicesAt('HEAD').map((entry) => ({
		...entry,
		changed: before.get(entry.service) !== entry.inputs,
	}));
	return { services, changed: services.filter(({ changed }) => changed).map(({ service }) => service) };
}
