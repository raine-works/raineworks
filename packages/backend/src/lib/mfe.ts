import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAssetHeaders, isStandaloneMode } from '@app/tools/http';

export { isStandaloneMode };

/**
 * A frontend package mounted at a route prefix.
 */
export interface MicroFrontend {
	/** URL path segment this frontend is served under (`''` for root). */
	route: string;
	/** Absolute path to the frontend's `dist` directory (local filesystem, dev mode only). */
	distDir: string;
}

/**
 * Resolves the built dist directory for a frontend package across both execution contexts:
 * - Embedded standalone binary: handled separately via `Bun.embeddedFiles` in `serveMicroFrontends`.
 * - Local filesystem (dev/production without compilation): `packages/<name>/dist`.
 */
export function resolveLocalDist(packageName: string): string {
	return join(import.meta.dir, `../../../${packageName}/dist`);
}

/**
 * Serves one or more frontend packages as micro-frontends, plus SPA fallback for
 * client-side routes. Works identically whether running from source (dev), from
 * local `dist/` directories (production, uncompiled), or from a `bun build --compile
 * --asset=mfes` standalone binary (production, embedded — see `scripts/build.ts`).
 *
 * The first entry in `frontends` with `route: ''` is the root application; any other
 * entries are mounted under `/<route>/*`.
 *
 * @param req - The incoming HTTP `Request`.
 * @param frontends - Ordered list of frontend packages to serve.
 * @returns An HTTP `Response` streaming the requested asset or an SPA `index.html` fallback.
 */
export async function serveMicroFrontends(req: Request, frontends: MicroFrontend[]): Promise<Response> {
	const url = new URL(req.url);
	const urlPath = url.pathname;
	const pathSegments = urlPath.split('/').filter(Boolean);
	const firstSegment = pathSegments[0] ?? '';

	const embeddedFiles = (Bun.embeddedFiles ?? []) as Array<Blob & { name?: string }>;
	const scoped = firstSegment ? frontends.find((f) => f.route === firstSegment) : undefined;
	const root = frontends.find((f) => f.route === '');

	// --- Embedded standalone binary mode ---
	if (embeddedFiles.length > 0) {
		if (scoped) {
			const subPath = pathSegments.slice(1).join('/') || 'index.html';
			const asset = embeddedFiles.find((f) => f.name === `mfes/${scoped.route}/${subPath}`);
			if (asset) return new Response(asset, { headers: getAssetHeaders(subPath) });
			if (/\.[a-zA-Z0-9]+$/.test(subPath)) return new Response('Not Found', { status: 404 });

			const index = embeddedFiles.find((f) => f.name === `mfes/${scoped.route}/index.html`);
			if (index) return new Response(index, { headers: getAssetHeaders('index.html') });
		}

		if (root) {
			const rootRoute = root.route === '' ? '__root__' : root.route;
			const cleanPath = urlPath.replace(/^\//, '') || 'index.html';
			const asset = embeddedFiles.find((f) => f.name === `mfes/${rootRoute}/${cleanPath}`);
			if (asset) return new Response(asset, { headers: getAssetHeaders(cleanPath) });
			if (/\.[a-zA-Z0-9]+$/.test(cleanPath)) return new Response('Not Found', { status: 404 });

			const index = embeddedFiles.find((f) => f.name === `mfes/${rootRoute}/index.html`);
			if (index) return new Response(index, { headers: getAssetHeaders('index.html') });
		}

		return new Response('Not Found', { status: 404 });
	}

	// --- Local filesystem mode (dev, or production without compilation) ---
	if (scoped && existsSync(scoped.distDir)) {
		const subPath = pathSegments.slice(1).join('/');
		if (subPath) {
			const file = Bun.file(join(scoped.distDir, subPath));
			if (await file.exists()) return new Response(file, { headers: getAssetHeaders(subPath) });
			if (/\.[a-zA-Z0-9]+$/.test(subPath)) return new Response('Not Found', { status: 404 });
		}
		const index = Bun.file(join(scoped.distDir, 'index.html'));
		if (await index.exists()) return new Response(index, { headers: getAssetHeaders('index.html') });
	}

	if (root) {
		const assetPath = join(root.distDir, urlPath);
		const file = Bun.file(assetPath);
		if (await file.exists()) return new Response(file, { headers: getAssetHeaders(urlPath) });
		if (/\.[a-zA-Z0-9]+$/.test(urlPath)) return new Response('Not Found', { status: 404 });

		const index = Bun.file(join(root.distDir, 'index.html'));
		if (await index.exists()) return new Response(index, { headers: getAssetHeaders('index.html') });
	}

	return new Response("Frontend not built yet. Run 'bun run build'.", {
		status: 503,
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
