/**
 * Draws the brand assets in `brand/` at the repository's root, and the site's favicon and home-screen icon
 * (`src/assets/favicon.svg`, `src/assets/apple-touch-icon.png`): the mark and the logo, drawn from `blocks/brand`, in
 * the accent gradient and in black and white, on white, on black and on nothing, as SVG and PNG; the favicons; and
 * the social images (avatars, the X header, the LinkedIn banner, GitHub's social preview). Rasterised by a headless
 * Chrome, drawing each SVG onto a canvas, so PNGs keep their transparency. Run it again when the logo or the
 * accent's colours change; `bun run og-image` draws the share image.
 *
 * ```bash
 * bun run brand-assets [path/to/chrome]   # defaults to macOS's Google Chrome
 * ```
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { AppLogo, AppMark, type MarkGradient } from '@raineworks/ui/blocks/brand';
import { renderToStaticMarkup } from 'react-dom/server';

const chrome = process.argv[2] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = join(import.meta.dir, '../../..', 'brand');
const assets = join(import.meta.dir, '../src/assets');

/** The accent, as `globals.css` has it: `--gradient-from` into `--gradient-to`. */
const GRADIENT: MarkGradient = { from: '#ea9a7e', to: '#2998ad' };
const BLACK = '#000000';
const WHITE = '#ffffff';
/** The site's dark background (`--background` in `.dark`), for the icons a phone or browser shows beside it. */
const NEAR_BLACK = '#0a0a0a';

/** The source's stroke (1.6 units), drawn for a logo hundreds of pixels wide. */
const STROKE = 1.6;

interface Variant {
	name: string;
	/** The background, or none (transparent). */
	background: string | null;
	/** The wordmark's colour (and the mark's, without `gradient`). */
	ink: string;
	gradient: boolean;
}

const VARIANTS: Variant[] = [
	{ name: 'gradient-on-black', background: BLACK, ink: WHITE, gradient: true },
	{ name: 'gradient-on-white', background: WHITE, ink: BLACK, gradient: true },
	{ name: 'gradient-white-transparent', background: null, ink: WHITE, gradient: true },
	{ name: 'gradient-black-transparent', background: null, ink: BLACK, gradient: true },
	{ name: 'black-on-white', background: WHITE, ink: BLACK, gradient: false },
	{ name: 'white-on-black', background: BLACK, ink: WHITE, gradient: false },
	{ name: 'black-transparent', background: null, ink: BLACK, gradient: false },
	{ name: 'white-transparent', background: null, ink: WHITE, gradient: false },
];

/** The inside of a rendered `<svg>`, its gradient's id made stable and its colour set. */
function innerSvg(markup: string, ink: string): string {
	const inner = markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
	const id = inner.match(/<linearGradient id="([^"]+)"/)?.[1];
	const named = id
		? inner.replaceAll(`id="${id}"`, 'id="raineworks-gradient"').replaceAll(`url(#${id})`, 'url(#raineworks-gradient)')
		: inner;
	return named.replaceAll('currentColor', ink);
}

const markInner = (variant: Variant, strokeWidth = STROKE) =>
	innerSvg(
		renderToStaticMarkup(<AppMark strokeWidth={strokeWidth} gradient={variant.gradient ? GRADIENT : undefined} />),
		variant.ink,
	);

const logoInner = (variant: Variant, strokeWidth = STROKE) =>
	innerSvg(
		renderToStaticMarkup(<AppLogo strokeWidth={strokeWidth} gradient={variant.gradient ? GRADIENT : undefined} />),
		variant.ink,
	);

/** A standalone SVG of `body` in `viewBox` ("x y width height"), on `background` (with corner `radius`) or nothing. */
function svgFile(viewBox: string, body: string, background: string | null, radius = 0): string {
	const [x, y, width, height] = viewBox.split(' ');
	const backdrop = background
		? `<rect x="${x}" y="${y}" width="${width}" height="${height}"${radius ? ` rx="${radius}"` : ''} fill="${background}"/>`
		: '';
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><title>raineworks</title>${backdrop}${body}</svg>\n`;
}

/** The mark, its circle 82% of the square. */
const ICON_BOX = '-56 -56 112 112';
/** The mark and wordmark, with a margin of half the mark's height. */
const LOGO_BOX = '-72 -72 514.8 144';

/** A file to write: SVG text as it is, or an SVG to rasterise at `width` × `height` as `type`. */
type Output =
	| { path: string; svg: string }
	| { path: string; from: string; width: number; height: number; type: 'image/png' | 'image/webp' };

const outputs: Output[] = [];
const svgOut = (path: string, svg: string) => outputs.push({ path, svg });
const raster = (
	path: string,
	from: string,
	width: number,
	height: number,
	type: 'image/png' | 'image/webp' = 'image/png',
) => outputs.push({ path, from, width, height, type });

// The mark and the logo, every variant, as SVG and PNG.
for (const variant of VARIANTS) {
	const logo = svgFile(LOGO_BOX, logoInner(variant), variant.background);
	svgOut(`svg/raineworks-logo-${variant.name}.svg`, logo);
	// Without the wordmark, the gradient mark on nothing is one icon whatever the ink: `gradient-transparent`.
	const iconName = variant.gradient && !variant.background ? 'gradient-transparent' : variant.name;
	if (variant.ink === WHITE || !iconName.startsWith('gradient-transparent')) {
		const icon = svgFile(ICON_BOX, markInner(variant), variant.background);
		svgOut(`svg/raineworks-icon-${iconName}.svg`, icon);
		for (const size of [512, 1024]) raster(`png/raineworks-icon-${iconName}-${size}.png`, icon, size, size);
	}
	for (const width of [1000, 2000])
		raster(`png/raineworks-logo-${variant.name}-${width}.png`, logo, width, Math.round((width * 144) / 514.8));
}

/** The favicon: the gradient mark on a tile, white or the dark background with the OS's scheme. */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-52.8 -52.8 105.6 105.6"><title>raineworks</title><style>rect{fill:${WHITE}}@media (prefers-color-scheme:dark){rect{fill:${NEAR_BLACK}}}</style><rect x="-52.8" y="-52.8" width="105.6" height="105.6" rx="14"/>${markInner(VARIANTS[1]!, 3.2)}</svg>\n`;
/** The icons a browser or phone shows: the gradient mark on the dark background, heavier the smaller it's drawn. */
const tile = (strokeWidth: number, radius = 0) =>
	svgFile('-52.8 -52.8 105.6 105.6', markInner(VARIANTS[0]!, strokeWidth), NEAR_BLACK, radius);

svgOut('favicon/favicon.svg', FAVICON);
raster('favicon/favicon-16.png', tile(4.4, 14), 16, 16);
raster('favicon/favicon-32.png', tile(3.6, 14), 32, 32);
raster('favicon/favicon-48.png', tile(3.2, 14), 48, 48);
raster('favicon/favicon-192.png', tile(2.4), 192, 192);
raster('favicon/favicon-512.png', tile(2), 512, 512);
raster('favicon/favicon.webp', tile(2), 512, 512, 'image/webp');
raster('favicon/apple-touch-icon.png', tile(2.4), 180, 180);

/** A faint wash of the two colours, as the hero's glow (`gradient-glow`), for the social images. */
const glow = (cx: number, cy: number, r: number, color: string, opacity: number, id: string) =>
	`<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="url(#${id})"/>`;

/** A wide image: black, the two colours glowing faintly behind the logo at (`x`, `y`), `scale` units per pixel. */
function banner(width: number, height: number, logoX: number, logoY: number, scale: number): string {
	const logo = `<g transform="translate(${logoX} ${logoY}) scale(${scale})">${logoInner(VARIANTS[0]!, 2.4)}</g>`;
	const washes = [
		glow(logoX - 20 * scale, logoY - 30 * scale, 160 * scale, GRADIENT.from, 0.22, 'wash-from'),
		glow(logoX + 60 * scale, logoY + 40 * scale, 200 * scale, GRADIENT.to, 0.2, 'wash-to'),
	].join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><title>raineworks</title><rect width="${width}" height="${height}" fill="${BLACK}"/>${washes}${logo}</svg>\n`;
}

/** An avatar: the gradient mark, inside the circle a platform crops it to, on black or white. */
const avatar = (variant: Variant) => svgFile('-64 -64 128 128', markInner(variant, 2.2), variant.background);

const avatarDark = avatar(VARIANTS[0]!);
const avatarLight = avatar(VARIANTS[1]!);
svgOut('social/avatar-gradient-on-black.svg', avatarDark);
svgOut('social/avatar-gradient-on-white.svg', avatarLight);
for (const size of [400, 1000]) {
	raster(`social/avatar-gradient-on-black-${size}.png`, avatarDark, size, size);
	raster(`social/avatar-gradient-on-white-${size}.png`, avatarLight, size, size);
}
// The logo is centred on its mark's centre plus half the wordmark: (466.8 / 2 - 48) units right of the mark.
const centred = (width: number, scale: number) => width / 2 - (466.8 / 2 - 48) * scale;
const xHeader = banner(1500, 500, centred(1500, 1.6), 250, 1.6);
const linkedIn = banner(1584, 396, 1584 - 120 - 418.8 * 1.3, 198, 1.3);
const github = banner(1280, 640, centred(1280, 1.8), 320, 1.8);
svgOut('social/x-header.svg', xHeader);
svgOut('social/linkedin-banner.svg', linkedIn);
svgOut('social/github-social-preview.svg', github);
raster('social/x-header-1500x500.png', xHeader, 1500, 500);
raster('social/linkedin-banner-1584x396.png', linkedIn, 1584, 396);
raster('social/github-social-preview-1280x640.png', github, 1280, 640);

/** The page Chrome runs: each SVG drawn onto a canvas and encoded, the results written into the DOM it dumps. */
const rasterPage = (jobs: { from: string; width: number; height: number; type: string }[]) => `<!doctype html>
<pre id="out"></pre>
<script>
const jobs = ${JSON.stringify(jobs).replace(/</g, '\\u003c')};
(async () => {
	const results = [];
	for (const job of jobs) {
		const image = new Image();
		image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(job.from);
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = job.width;
		canvas.height = job.height;
		const context = canvas.getContext('2d');
		context.imageSmoothingQuality = 'high';
		context.drawImage(image, 0, 0, job.width, job.height);
		results.push(canvas.toDataURL(job.type, 0.95).split(',')[1]);
	}
	document.getElementById('out').textContent = JSON.stringify(results);
})();
</script>`;

const rasters = outputs.filter((output) => 'from' in output);
const workDir = mkdtempSync(join(tmpdir(), 'raineworks-brand-'));
let encoded: string[];
try {
	const html = join(workDir, 'raster.html');
	await Bun.write(html, rasterPage(rasters));
	const run = Bun.spawnSync([
		chrome,
		'--headless=new',
		'--no-sandbox',
		'--virtual-time-budget=20000',
		'--dump-dom',
		Bun.pathToFileURL(html).href,
	]);
	const dom = run.stdout.toString();
	const json = dom.match(/<pre id="out">(\[.*?\])<\/pre>/s)?.[1];
	if (run.exitCode !== 0 || !json) throw new Error(`Chrome failed: ${run.stderr.toString()}`);
	encoded = JSON.parse(json) as string[];
} finally {
	rmSync(workDir, { recursive: true, force: true });
}

const write = async (path: string, data: string | Uint8Array) => {
	mkdirSync(dirname(path), { recursive: true });
	await Bun.write(path, data);
};

const bytes = new Map<string, Uint8Array>();
for (const [index, output] of rasters.entries()) bytes.set(output.path, Buffer.from(encoded[index]!, 'base64'));
for (const output of outputs)
	await write(join(root, output.path), 'svg' in output ? output.svg : bytes.get(output.path)!);

/** An `.ico` of PNG images (Vista onwards reads them), largest last. */
function ico(images: { size: number; png: Uint8Array }[]): Uint8Array {
	const header = Buffer.alloc(6 + 16 * images.length);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);
	let offset = header.length;
	for (const [index, { size, png }] of images.entries()) {
		const entry = 6 + 16 * index;
		header.writeUInt8(size >= 256 ? 0 : size, entry);
		header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
		header.writeUInt16LE(1, entry + 4);
		header.writeUInt16LE(32, entry + 6);
		header.writeUInt32LE(png.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);
		offset += png.length;
	}
	return Buffer.concat([header, ...images.map((image) => image.png)]);
}
await write(
	join(root, 'favicon/favicon.ico'),
	ico([16, 32, 48].map((size) => ({ size, png: bytes.get(`favicon/favicon-${size}.png`)! }))),
);

// The site's own: the favicon and the home-screen icon.
await write(join(assets, 'favicon.svg'), FAVICON.trimEnd());
await write(join(assets, 'apple-touch-icon.png'), bytes.get('favicon/apple-touch-icon.png')!);

console.log(`✅ Wrote ${outputs.length + 1} files to ${root}, and the favicon and home-screen icon to ${assets}`);
