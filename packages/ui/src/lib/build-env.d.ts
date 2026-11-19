/** Stamped by every zone's build (`@raineworks/tools/build`): the version being built and its commit. */
declare const __RAINEWORKS_VERSION__: string;
declare const __RAINEWORKS_COMMIT__: string;

/** Release notes (`release-notes/<version>.md`), rendered at build time (`@raineworks/tools/markdown`). */
declare module 'raineworks:release-notes' {
	type DocMeta = import('@raineworks/tools/markdown').DocMeta;
	type RenderedDoc = import('@raineworks/tools/markdown').RenderedDoc;
	export const docs: Array<DocMeta & { load: () => Promise<{ default: RenderedDoc }> }>;
}
