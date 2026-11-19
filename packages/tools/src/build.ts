/**
 * Builds a web zone with `Bun.build`: the React Compiler, Tailwind and the release notes plugin, the version and
 * commit stamped in, `<link rel="modulepreload">` for the entry's static imports, the third-party notices for what
 * it bundled (`notices.json`, `@raineworks/tools/notices`), and `.br` / `.gz` siblings for the server to send as they
 * are. The only bundler: no zone builds any other way.
 *
 * Fonts are files of their own (`fontFilesPlugin`), never inlined into the stylesheet. A zone that prerenders
 * (`prerender`) gets a page per route, rendered at build time into a copy of its `index.html` with its own head
 * (`<path>/index.html`, `404.html`), and a `sitemap.xml` (and, at the root, a `robots.txt`) listing them.
 *
 * @module build
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';

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
	/**
	 * Files served as they are under a content-hashed name, such as a page's share image. {@link PrerenderContext}
	 * `assets` maps each one's file name to its public path.
	 */
	publicFiles?: string[];
	/** Renders the zone's pages at build time, so they show (and unfurl) before any script runs. */
	prerender?: PrerenderOptions;
}

/** How a zone prerenders its pages. */
export interface PrerenderOptions {
	/** The module that renders them, exporting `prerender` ({@link PrerenderModule}), bundled for Bun. */
	entry: string;
	/** Where the site is public (`https://raineworks.com`), for `sitemap.xml` and `robots.txt`. */
	siteUrl: string;
}

/** What a zone's prerender module is given. */
export interface PrerenderContext {
	/** The public path of each of `publicFiles`, by its file name (`og-image.png` → `/og-image-x.png`). */
	assets: Record<string, string>;
}

/** One page, rendered. */
export interface PrerenderedPage {
	/** Its path inside the zone (`/work`); the page for paths nothing matches has status 404. */
	path: string;
	status: 200 | 404;
	/** Its `<head>` tags: they replace the template's `<title>`. */
	head: string;
	/** The zone's markup for it, rendered into `#root` for the client to hydrate. */
	markup: string;
	/** Left out of `sitemap.xml`: a page that may be off (the articles, without an X API token). */
	unlisted?: boolean;
}

/** A zone's prerender module (`PrerenderOptions.entry`). */
export interface PrerenderModule {
	prerender(context: PrerenderContext): Promise<PrerenderedPage[]>;
}

/** Where a page's markup goes in the zone's `index.html`. */
const ROOT_ELEMENT = '<div id="root"></div>';
const TITLE_ELEMENT = /<title>[^<]*<\/title>/;

/** The letters of a content hash, as `isContentHashed` (`@raineworks/tools/http`) knows them. */
const HASH_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** `name` with eight letters of `bytes`' hash before its extension (`og-image-k3v9x0ab.png`), cached for a year. */
export function contentHashedName(name: string, bytes: Uint8Array): string {
	let hash = BigInt(Bun.hash.wyhash(bytes));
	let suffix = '';
	for (let index = 0; index < 8; index++) {
		suffix += HASH_ALPHABET[Number(hash & 31n)];
		hash >>= 5n;
	}
	const dot = name.lastIndexOf('.');
	return dot === -1 ? `${name}-${suffix}` : `${name.slice(0, dot)}-${suffix}${name.slice(dot)}`;
}

/**
 * Keeps the fonts a stylesheet references out of it. Bun inlines every CSS `url()` asset as base64, so each subset of
 * each font (Cyrillic, Greek, Vietnamese…) would be in the render-blocking stylesheet; as files of their own, under a
 * content-hashed name, a browser fetches only the subsets a page uses (`unicode-range`). `emitted` collects them, by
 * public name, for the build to copy.
 */
export function fontFilesPlugin(publicPath: string, emitted: Map<string, string>): BunPlugin {
	return {
		name: 'raineworks:font-files',
		setup(build) {
			build.onResolve({ filter: /\.woff2?$/ }, (args) => {
				const source = isAbsolute(args.path) ? args.path : join(dirname(args.importer), args.path);
				const name = contentHashedName(basename(source), readFileSync(source));
				emitted.set(name, source);
				return { path: `${publicPath}${name}`, external: true };
			});
		},
	};
}

/** A page's file in the zone's output: `index.html` at its root, `<path>/index.html` below it, `404.html`. */
export function pageFile(page: Pick<PrerenderedPage, 'path' | 'status'>): string {
	if (page.status === 404) return '404.html';
	const path = page.path.replace(/^\/+|\/+$/g, '');
	return path ? join(path, 'index.html') : 'index.html';
}

/** The zone's `index.html` with `page` in it: its head in place of the `<title>`, its markup in `#root`. */
export function renderPage(template: string, page: PrerenderedPage): string {
	if (!TITLE_ELEMENT.test(template) || !template.includes(ROOT_ELEMENT))
		throw new Error(`The page template needs a <title> and an empty ${ROOT_ELEMENT} to prerender into.`);
	return template
		.replace(TITLE_ELEMENT, () => page.head)
		.replace(ROOT_ELEMENT, () => `<div id="root">${page.markup}</div>`);
}

/**
 * A prerendered page's scripts, loaded once the page has: it's all in its HTML (links work without them), so they only
 * hydrate it, and mustn't compete with the stylesheet and fonts for the first paint. The module script and its
 * `modulepreload`s become an inline script that, once the page's content has painted (its `first-contentful-paint`;
 * `load` where Paint Timing isn't supported), adds the preloads and imports the entry.
 */
export function hydrateAfterLoad(html: string): string {
	const entries: string[] = [];
	const preloads: string[] = [];
	const stripped = html
		.replace(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_, src: string) => {
			entries.push(src);
			return '';
		})
		.replace(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"[^>]*>/g, (_, href: string) => {
			preloads.push(href);
			return '';
		});
	if (entries.isEmpty()) return html;
	const load = `for(const h of ${JSON.stringify(preloads)}){const l=document.createElement("link");l.rel="modulepreload";l.href=h;document.head.append(l)}${entries.map((src) => `import(${JSON.stringify(src)})`).join(';')}`;
	const script = `<script>(()=>{let d=0;const go=()=>{if(d++)return;${load}};if(PerformanceObserver.supportedEntryTypes?.includes("paint"))new PerformanceObserver((l,o)=>{if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();setTimeout(go)}}).observe({type:"paint",buffered:true});else addEventListener("load",go,{once:true})})()</script>`;
	return stripped.replace('</head>', () => `${script}</head>`);
}

const escapeXml = (text: string) => text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

/** Every page found (not the 404, nor one `unlisted`) as a `sitemap.xml`, at `siteUrl` under the zone's `publicPath`. */
export function sitemapXml(pages: PrerenderedPage[], siteUrl: string, publicPath: string): string {
	const urls = pages
		.filter((page) => page.status === 200 && !page.unlisted)
		.map((page) => new URL(`${publicPath}${page.path.replace(/^\/+/, '')}`, siteUrl).href)
		.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`);
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`;
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
	const define = {
		// What every page shows, and what the update toast compares (`@raineworks/ui/lib/version`).
		__RAINEWORKS_VERSION__: JSON.stringify(info.version),
		__RAINEWORKS_COMMIT__: JSON.stringify(info.commit),
		'Bun.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
		'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
	};
	const fonts = new Map<string, string>();
	const buildResult = await Bun.build({
		entrypoints: [entrypoint],
		outdir,
		publicPath: options.publicPath,
		plugins: [fontFilesPlugin(options.publicPath, fonts), tailwind, ...frontendPlugins(), ...(options.plugins ?? [])],
		reactCompiler: true,
		target: 'browser',
		minify: isProduction,
		define,
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
	for (const [name, source] of fonts) await Bun.write(join(outdir, name), Bun.file(source));
	const assets: Record<string, string> = {};
	for (const source of options.publicFiles ?? []) {
		const name = contentHashedName(basename(source), await Bun.file(source).bytes());
		await Bun.write(join(outdir, name), Bun.file(source));
		assets[basename(source)] = `${options.publicPath}${name}`;
	}

	const html = buildResult.outputs.find((output) => output.kind === 'entry-point' && output.path.endsWith('.html'));
	if (html && buildResult.metafile) {
		const preloads = entryStaticImports(buildResult.metafile, options.publicPath);
		if (!preloads.isEmpty())
			await Bun.write(html.path, injectModulePreloads(await Bun.file(html.path).text(), preloads));
	}

	const written: string[] = [];
	const prerender = options.prerender;
	if (html && prerender) {
		const { data: files, error } = await tryCatch(() =>
			prerenderPages({ ...prerender, outdir, publicPath: options.publicPath, template: html.path, define, assets }),
		);
		if (error) {
			console.error(`❌ [${options.name}] Prerendering failed: ${error.message}`);
			if (!isWatch) process.exit(1);
			return buildResult;
		}
		written.push(...files);
	}

	// The server sends HTML compressed on the fly (it stamps each with the zone's build), so only the other outputs
	// are precompressed. Watch builds skip it: development serves identity.
	if (!isWatch) {
		await precompress([
			...buildResult.outputs.map((output) => output.path).filter((path) => path !== html?.path),
			...written.filter((path) => !path.endsWith('.html')),
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
 * Bundles the zone's prerender module for Bun, renders every page into a copy of `template` (`renderPage`) and writes
 * them, with `sitemap.xml` and, for the root zone, `robots.txt`. Returns the paths written.
 */
async function prerenderPages(
	options: PrerenderOptions & {
		outdir: string;
		publicPath: string;
		template: string;
		define: Record<string, string>;
		assets: Record<string, string>;
	},
): Promise<string[]> {
	const ssrDir = mkdtempSync(join(tmpdir(), 'raineworks-prerender-'));
	try {
		const result = await Bun.build({
			entrypoints: [options.entry],
			outdir: ssrDir,
			target: 'bun',
			plugins: frontendPlugins(),
			reactCompiler: true,
			define: options.define,
			throw: false,
		});
		const entry = result.outputs.find((output) => output.kind === 'entry-point');
		if (!result.success || !entry) throw new Error(result.logs.map(String).join('\n') || 'no module was built');
		const { prerender } = (await import(entry.path)) as PrerenderModule;
		const pages = await prerender({ assets: options.assets });
		const template = hydrateAfterLoad(await Bun.file(options.template).text());
		const written: string[] = [];
		for (const page of pages) {
			const path = join(options.outdir, pageFile(page));
			await Bun.write(path, renderPage(template, page));
			written.push(path);
		}
		const sitemap = join(options.outdir, 'sitemap.xml');
		await Bun.write(sitemap, sitemapXml(pages, options.siteUrl, options.publicPath));
		written.push(sitemap);
		if (options.publicPath === '/') {
			const robots = join(options.outdir, 'robots.txt');
			await Bun.write(robots, `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', options.siteUrl).href}\n`);
			written.push(robots);
		}
		return written;
	} finally {
		rmSync(ssrDir, { recursive: true, force: true });
	}
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
