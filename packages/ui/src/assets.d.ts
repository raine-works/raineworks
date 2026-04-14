/**
 * Ambient module declarations for static image assets.
 *
 * Vite resolves these imports as hashed URL strings at build time.
 * This declaration lets TypeScript understand the import shape so
 * the UI library can reference PNGs without `vite/client` types.
 *
 * @module assets.d.ts
 */

declare module '*.png' {
	const src: string;
	export default src;
}
