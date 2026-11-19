import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');

describe('dependency versions', () => {
	test('every package takes its versions from the root catalog (or the workspace), never its own', async () => {
		const strays: string[] = [];
		for (const manifest of new Bun.Glob('packages/*/package.json').scanSync({ cwd: ROOT })) {
			const pkg = (await Bun.file(join(ROOT, manifest)).json()) as Record<string, Record<string, string> | undefined>;
			for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
				for (const [name, version] of Object.entries(pkg[section] ?? {})) {
					if (!/^(catalog:(dev)?|workspace:\*)$/.test(version))
						strays.push(`${manifest} ${section}.${name}: ${version}`);
				}
			}
		}
		// A version belongs in package.json's workspaces.catalog (catalogs.dev for build and type tools), referenced as
		// `catalog:` / `catalog:dev`, so every package uses the same one.
		expect(strays).toEqual([]);
	});

	test('every catalog entry is an exact version: bunfig.toml pins installs, and so does the catalog', async () => {
		const root = (await Bun.file(join(ROOT, 'package.json')).json()) as {
			workspaces: { catalog: Record<string, string>; catalogs: Record<string, Record<string, string>> };
		};
		const entries = [root.workspaces.catalog, ...Object.values(root.workspaces.catalogs)].flatMap(Object.entries);
		const loose = entries.filter(([, version]) => !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version));
		expect(loose).toEqual([]);
	});
});
