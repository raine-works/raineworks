/**
 * Builds a web zone with `Bun.build`: the React Compiler, Tailwind and the release notes plugin, the version and
 * commit stamped in, `<link rel="modulepreload">` for the entry's static imports, the third-party notices for what
 * it bundled (`notices.json`, `@raineworks/tools/notices`), and `.br` / `.gz` siblings for the server to send as they
 * are. The only bundler: no zone builds any other way.
 *
 * @module build
 */

import { existsSync, rmSync, watch } from 'node:fs';
import { basename, join } from 'node:path';

import { buildEnv } from '@raineworks/tools/build-env';
import { compressBytes, CONTENT_ENCODINGS, ENCODING_SUFFIX, isCompressible } from '@raineworks/tools/http';
import { markdownPlugin } from '@raineworks/tools/markdown';
import { collectNotices, NOTICES_FILE, type NoticesFile } from '@raineworks/tools/notices';
import { tryCatch } from '@raineworks/tools/prototypes';
import { buildInfo, RELEASE_NOTES_DIR } from '@raineworks/tools/version';
import type { BunPlugin } from 'bun';
import tailwind from 'bun-plugin-tailwind';

/**
 * Options for configuring the frontend build runner.
 */
export interface FrontendBuildOptions {
	/** Human-readable name of the application/micro-frontend (e.g. 'web-marketing'). */
	name: string;
	/** Root directory of the package (containing `src/` and `index.html`). */
	packageDir: string;
	/** Base public URL path for emitted assets (`zonePublicPath`, `@raineworks/tools/zones`). */
	publicPath: string;
	/** Path to the HTML entrypoint (defaults to `packageDir/index.html`). */
	entrypoint?: string;
	/** Output directory for the bundled assets (defaults to `packageDir/dist`). */
	outdir?: string;
	/** Source directory to watch in dev mode (defaults to `packageDir/src`). */
	srcDir?: string;
	/** More directories to watch in dev mode, such as a shared package's `src` the zone bundles (`@raineworks/ui`). */
	watchDirs?: string[];
	/** Whether watch mode is active (defaults to checking `--watch` in `process.argv`). */
	isWatch?: boolean;
	/** Whether production mode is active (defaults to `NODE_ENV === 'production' || !isWatch`). */
	isProduction?: boolean;
	/** Bundler plugins besides Tailwind, e.g. one that loads Markdown. */
	plugins?: BunPlugin[];
}

/** Plugins every zone's build has: its release notes (`raineworks:release-notes`, `@raineworks/tools/markdown`). */
export const frontendPlugins = (): BunPlugin[] => [
	markdownPlugin([{ module: 'raineworks:release-notes', dir: RELEASE_NOTES_DIR, sort: 'version' }]),
];

/**
 * Executes a single build pass for a micro-frontend or client SPA using `Bun.build`.
 *
 * @param options - Frontend build options.
 * @returns Bun BuildOutput result object.
 */
export async function buildFrontend(options: FrontendBuildOptions) {
	const isWatch = options.isWatch ?? process.argv.includes('--watch');
	const isProduction = options.isProduction ?? (buildEnv().NODE_ENV === 'production' || !isWatch);
	const outdir = options.outdir ?? join(options.packageDir, 'dist');
	const entrypoint = options.entrypoint ?? join(options.packageDir, 'index.html');

	if (!isWatch && existsSync(outdir)) {
		rmSync(outdir, { recursive: true, force: true });
	}

	const info = buildInfo();
	const buildResult = await Bun.build({
		entrypoints: [entrypoint],
		outdir,
		publicPath: options.publicPath,
		plugins: [tailwind, ...frontendPlugins(), ...(options.plugins ?? [])],
		reactCompiler: true,
		target: 'browser',
		minify: isProduction,
		define: {
			// What every page shows, and what the update toast compares (`@raineworks/ui/lib/version`).
			__RAINEWORKS_VERSION__: JSON.stringify(info.version),
			__RAINEWORKS_COMMIT__: JSON.stringify(info.commit),
			'Bun.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
			'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
		},
		splitting: true,
		sourcemap: isWatch ? 'linked' : 'none',
		metafile: true,
		// Bun.build throws on a failed build by default; the result says why instead, so a watch keeps going.
		throw: false,
	});

	if (!buildResult.success) {
		console.error(`❌ [${options.name}] Build failed:`);
		for (const log of buildResult.logs) {
			console.error(log);
		}
		if (!isWatch) {
			process.exit(1);
		}
		return buildResult;
	}

	// What the bundle is made of and under which licences, for About (`@raineworks/ui/blocks/notices`). A package that
	// doesn't say what it's under, or is under a licence the app can't ship with, fails the build like any other error.
	const { data: notices, error: noticesError } = tryCatch(() =>
		collectNotices(Object.keys(buildResult.metafile?.inputs ?? {})),
	);
	if (noticesError) {
		console.error(`❌ [${options.name}] ${noticesError.message}`);
		if (!isWatch) {
			process.exit(1);
		}
		return buildResult;
	}
	const noticesPath = join(outdir, NOTICES_FILE);
	await Bun.write(noticesPath, JSON.stringify({ notices } satisfies NoticesFile));

	// Beside the zone's files: which version and commit they are, for `GET /api/build` (`@raineworks/server/lib/spa`).
	await Bun.write(join(outdir, 'build.json'), JSON.stringify(info));
	const html = buildResult.outputs.find((output) => output.kind === 'entry-point' && output.path.endsWith('.html'));
	if (html && buildResult.metafile) {
		const preloads = entryStaticImports(buildResult.metafile, options.publicPath);
		if (!preloads.isEmpty())
			await Bun.write(html.path, injectModulePreloads(await Bun.file(html.path).text(), preloads));
	}
	// The server renders the HTML entry per request (it carries a CSP nonce), so only the other outputs are
	// precompressed. Watch builds skip it: development serves identity.
	if (!isWatch) {
		await precompress([
			...buildResult.outputs.map((output) => output.path).filter((path) => path !== html?.path),
			noticesPath,
		]);
	}

	console.log(`✅ [${options.name}] Build succeeded! Emitted ${buildResult.outputs.length} files to ${outdir}`);
	for (const output of buildResult.outputs) {
		console.log(`   - ${output.path} (${output.size} bytes)`);
	}

	return buildResult;
}

/**
 * Public URLs of the chunks the entry script imports statically: the browser would only find them after
 * downloading and parsing the entry, so `<link rel="modulepreload">` starts them at once. Dynamic imports are
 * left to load on demand, with what they import: Bun marks each `import()` chunk as an entry point too, so the
 * page's entries are the ones nothing imports dynamically.
 */
export function entryStaticImports(metafile: Bun.BuildMetafile, publicPath: string): string[] {
	const outputs = metafile.outputs;
	const lazy = new Set(
		Object.values(outputs).flatMap((output) =>
			(output.imports ?? []).filter(({ kind }) => kind === 'dynamic-import').map(({ path }) => basename(path)),
		),
	);
	const seen = new Set<string>();
	const visit = (key: string) => {
		for (const { path, kind } of outputs[key]?.imports ?? []) {
			if (kind !== 'import-statement') continue;
			const name = basename(path);
			if (seen.has(name)) continue;
			seen.add(name);
			const next = Object.keys(outputs).find((candidate) => basename(candidate) === name);
			if (next) visit(next);
		}
	};
	for (const [key, output] of Object.entries(outputs)) {
		if (output.entryPoint && /\.m?js$/.test(key) && !lazy.has(basename(key))) visit(key);
	}
	return [...seen].map((name) => `${publicPath}${name}`);
}

/** Adds a `<link rel="modulepreload">` per href just before the module script (or `</head>`). */
export function injectModulePreloads(html: string, hrefs: string[]): string {
	const links = hrefs
		.filter((href) => !html.includes(`href="${href}"`))
		.map((href) => `<link rel="modulepreload" crossorigin href="${href}">`)
		.join('');
	if (!links) return html;
	const script = html.search(/<script\b[^>]*type="module"/);
	if (script !== -1) return `${html.slice(0, script)}${links}${html.slice(script)}`;
	return html.replace('</head>', `${links}</head>`);
}

/**
 * Writes a `.br` (quality 11) and `.gz` (level 9) sibling next to each compressible output, when smaller, so the
 * server can send them as they are (`@raineworks/server/lib/spa`).
 */
export async function precompress(paths: string[]): Promise<void> {
	await Promise.all(
		paths.filter(isCompressible).map(async (path) => {
			const bytes = await Bun.file(path).bytes();
			for (const encoding of CONTENT_ENCODINGS) {
				const compressed = compressBytes(bytes, encoding, 'max');
				if (compressed.byteLength < bytes.byteLength)
					await Bun.write(`${path}${ENCODING_SUFFIX[encoding]}`, compressed);
			}
		}),
	);
}

/**
 * Runs the frontend build pipeline for CLI execution, handling initial build and `--watch` mode.
 *
 * @param options - Frontend build options.
 */
export async function runFrontendBuildCli(options: FrontendBuildOptions): Promise<void> {
	const isWatch = options.isWatch ?? process.argv.includes('--watch');
	const packageDir = options.packageDir;
	const srcDir = options.srcDir ?? join(packageDir, 'src');
	const entrypoint = options.entrypoint ?? join(packageDir, 'index.html');

	console.log(`⚡ Building ${options.name} with Bun.build, Tailwind CSS, and React Compiler...`);
	await buildFrontend(options);

	if (isWatch) {
		const dirs = [srcDir, ...(options.watchDirs ?? [])].filter((dir) => existsSync(dir));
		console.log(`👀 Watching for changes in ${options.name} (${dirs.length} source dirs and index.html)...`);

		let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
		const triggerRebuild = (file: string) => {
			if (rebuildTimer) clearTimeout(rebuildTimer);
			rebuildTimer = setTimeout(async () => {
				console.log(`🔄 File changed (${file}), rebuilding ${options.name}...`);
				await buildFrontend(options);
			}, 50);
		};

		const dirWatchers = dirs.map((dir) =>
			watch(dir, { recursive: true }, (_, filename) => {
				if (filename) triggerRebuild(filename);
			}),
		);

		const indexWatcher = existsSync(entrypoint)
			? watch(entrypoint, () => {
					triggerRebuild('index.html');
				})
			: null;

		const cleanup = () => {
			// A change just before the signal has a rebuild waiting on its debounce: it mustn't run once stopped.
			if (rebuildTimer) clearTimeout(rebuildTimer);
			for (const watcher of dirWatchers) watcher.close();
			indexWatcher?.close();
			process.exit(0);
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
	}
}
