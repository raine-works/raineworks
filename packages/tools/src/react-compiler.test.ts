/**
 * Guards React Compiler coverage. Zones are built with Bun's native
 * `reactCompiler` (`@raineworks/tools/build`), which silently leaves out any
 * component or hook that breaks the Rules of React (a ref read in render, a
 * computed key in a destructuring rest, …): it still works, just unmemoized.
 * This builds every zone the same way, in memory, and fails for each
 * first-party `.tsx` component or hook that came out without a compiler cache.
 *
 * Fix the code rather than allowlisting it (docs/frontend.md, "Build & serve").
 *
 * @module react-compiler.test
 */

import { describe, expect, test } from 'bun:test';
import { join, relative, resolve } from 'node:path';

import { frontendPlugins } from '@raineworks/tools/build';
import { ZONES } from '@raineworks/tools/zones';
import type { BunPlugin } from 'bun';

/**
 * Components and hooks the compiler may skip, by `<path from packages/>#<name>`,
 * each with why it's left alone.
 */
const ALLOWED: Record<string, string> = {};

const ROOT = resolve(import.meta.dir, '../../..');

/** A zone's own bundler plugins (`scripts/plugins.ts`, e.g. the developers zone's Markdown), if it has any. */
async function zonePlugins(pkg: string): Promise<BunPlugin[]> {
	const path = join(ROOT, 'packages', pkg, 'scripts/plugins.ts');
	if (!(await Bun.file(path).exists())) return [];
	return ((await import(path)) as { plugins: BunPlugin[] }).plugins;
}

/** A compiled function opens with its memo cache: `const $ = react_compiler_runtime.c(n)`. */
const CACHE = /\breact_compiler_runtime\w*\.c\(/;
const JSX = /\bjsx_runtime\w*\.jsxs?\(|\bjsxs?\(/;

interface Found {
	kind: 'component' | 'hook';
	compiled: boolean;
}

/**
 * The top-level components and hooks in one module's bundled code. Bun prints
 * each top-level statement from column 0 and indents the rest, so a statement
 * runs until the next line that starts with something other than whitespace
 * or a closing bracket (`}`, `})`, `};`).
 */
function functionsIn(code: string): Map<string, Found & { body: string }> {
	const found = new Map<string, Found & { body: string }>();
	for (const statement of code.split(/\n(?=[^\s})\]])/)) {
		const name =
			/^(?:async )?function (\w+)\(/.exec(statement)?.[1] ??
			/^var (\w+) = (?:async )?(?:\(|function\b|\w+ =>)/.exec(statement)?.[1];
		if (!name) continue;
		const isHook = /^use[A-Z0-9]/.test(name);
		if (!isHook && !(/^[A-Z]/.test(name) && JSX.test(statement))) continue;
		found.set(name, { kind: isHook ? 'hook' : 'component', compiled: CACHE.test(statement), body: statement });
	}
	return found;
}

/**
 * Nothing for the compiler to memoize, so it adds no cache: a hook that only
 * reads a context (and throws outside its provider) or an external store, with no closure or JSX.
 */
function memoizesNothing(body: string): boolean {
	const inner = /^function \w+\([^)]*\) \{\n([\s\S]*)\}$/.exec(body.trimEnd())?.[1];
	return (
		inner !== undefined &&
		!/=>|\bfunction\b/.test(inner) &&
		!JSX.test(inner) &&
		[...inner.matchAll(/\b(use[A-Z]\w*)\(/g)].every(
			([, hook]) => hook === 'useContext' || hook === 'useSyncExternalStore',
		)
	);
}

/** Bun renames clashing top-level names (`Calendar` → `Calendar2`): map back to the name in the source. */
async function sourceName(path: string, name: string): Promise<string> {
	const stripped = name.replace(/\d+$/, '');
	if (stripped === name) return name;
	const source = await Bun.file(join(ROOT, path)).text();
	const declares = (candidate: string) => new RegExp(`(?:function|const|let) ${candidate}\\b`).test(source);
	return declares(name) || !declares(stripped) ? name : stripped;
}

async function compilerCoverage() {
	const coverage = new Map<string, Found>();
	const builds = await Promise.all(
		Object.values(ZONES).map(async (zone) =>
			Bun.build({
				entrypoints: [join(ROOT, 'packages', zone.package, 'src/main.tsx')],
				plugins: [...frontendPlugins(), ...(await zonePlugins(zone.package))],
				reactCompiler: true,
				target: 'browser',
				minify: false,
				splitting: false,
				external: ['*.css'],
				define: { 'process.env.NODE_ENV': '"production"', 'Bun.env.NODE_ENV': '"production"' },
			}),
		),
	);
	for (const build of builds) {
		if (!build.success) throw new AggregateError(build.logs, 'A zone failed to build');
		const output = build.outputs.find((artifact) => artifact.kind === 'entry-point');
		if (!output) throw new Error('A zone built no entry point');
		// Each module starts with a `// <path>` comment, relative to the working directory.
		const modules = (await output.text()).split(/^\/\/ (\S+)\n/m);
		for (let i = 1; i < modules.length; i += 2) {
			const path = relative(ROOT, resolve(modules[i] as string));
			if (!path.startsWith('packages/') || path.includes('node_modules') || !path.endsWith('.tsx')) continue;
			for (const [bundled, found] of functionsIn(modules[i + 1] as string)) {
				if (found.kind === 'hook' && !found.compiled && memoizesNothing(found.body)) continue;
				// Bundles tree-shake differently: compiled in any zone counts.
				const key = `${path.slice('packages/'.length)}#${await sourceName(path, bundled)}`;
				const seen = coverage.get(key);
				coverage.set(key, { kind: found.kind, compiled: found.compiled || (seen?.compiled ?? false) });
			}
		}
	}
	return coverage;
}

describe('React Compiler', () => {
	test('compiles every first-party component and hook in every zone', async () => {
		const coverage = await compilerCoverage();
		const skipped = [...coverage].filter(([key, found]) => !found.compiled && !(key in ALLOWED)).map(([key]) => key);
		// An allowance is stale once its component compiles. One no zone uses yet (a shadcn component waiting for its
		// first page) is kept for when one does.
		const stale = Object.keys(ALLOWED).filter((key) => coverage.get(key)?.compiled ?? false);
		expect(coverage.size).toBeGreaterThan(20);
		// Without splitting, Bun inlines `import()`ed modules too, so lazy routes and pieces are checked.
		expect(coverage.has('web-marketing/src/routes/work.tsx#WorkPage')).toBe(true);
		expect(coverage.has('ui/src/blocks/page.tsx#Page')).toBe(true);
		expect(skipped).toEqual([]);
		expect(stale).toEqual([]);
		// It builds every zone: seconds on a CI runner, well past the default 5 s as the zones grow.
	}, 60_000);
});
