/**
 * Draws the wallpapers in `brand/wallpapers/`: three dark designs from the raineworks mark (drawn from
 * `blocks/brand`) and the accent, peach into teal, for phones and desktops. Halo is the mark, large and glowing, in a
 * light rain; Storm is rain and circuit traces over the whole screen with the mark small; Eclipse is a slice of a huge
 * mark sweeping off the edge. The strokes glow like neon over near-black, with a faint grain that keeps the dark
 * gradients from banding. Each is laid out for its screen (portrait keeps clear of a lock screen's clock) and its
 * randomness is seeded, so a run draws the same images. Rendered by a headless Chrome at each screen's exact size.
 *
 * ```bash
 * bun run wallpapers [path/to/chrome] [only]   # Chrome defaults to macOS's; `only` draws the files whose names have it
 * ```
 *
 * @module scripts/wallpapers
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AppMark, type MarkGradient } from '@raineworks/ui/blocks/brand';
import { renderToStaticMarkup } from 'react-dom/server';

const chrome = process.argv[2] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/** Only the designs and screens whose file names contain this (`storm`, `5k`), when given. */
const only = process.argv[3];
const output = join(import.meta.dir, '../../..', 'brand/wallpapers');

/** The accent, as `globals.css` has it: `--gradient-from` into `--gradient-to`. */
const GRADIENT: MarkGradient = { from: '#ea9a7e', to: '#2998ad' };
const BACKGROUND = '#030304';

/** Each screen drawn for: its name in the file, and its size in pixels. */
const SCREENS = [
	{ name: 'pixel-11-pro', width: 1280, height: 2856 },
	{ name: 'iphone-pro-max', width: 1290, height: 2796 },
	{ name: '4k', width: 3840, height: 2160 },
	{ name: '5k', width: 5120, height: 2880 },
	{ name: 'macbook-pro-16', width: 3456, height: 2234 },
	{ name: 'ultrawide', width: 3440, height: 1440 },
] as const;

type Screen = (typeof SCREENS)[number];

/** The mark's strokes in its own coordinates (its circle r=46 on 0,0), stroked with gradient `id` (renamed, unique). */
function markStrokes(strokeWidth: number, gradient: MarkGradient, id: string): string {
	const markup = renderToStaticMarkup(<AppMark strokeWidth={strokeWidth} gradient={gradient} />);
	const inner = markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
	const from = inner.match(/<linearGradient id="([^"]+)"/)?.[1];
	if (!from) throw new Error('The mark has no gradient to rename.');
	return inner.replaceAll(`id="${from}"`, `id="${id}"`).replaceAll(`url(#${from})`, `url(#${id})`);
}

/** How much more it rains on a landscape screen than on a phone (`rain`). */
const LANDSCAPE_RAIN = 2.5;

/** How far apart, in pixels, the rain's strokes are grouped to glow (`rain`). */
const RAIN_TILE = 1000;

/** A seeded random number generator (a linear congruential one): the same seed, the same wallpaper. */
function random(seed: number): () => number {
	let state = seed;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

interface RainOptions {
	seed: number;
	/** Strokes per million pixels, at a phone's scale (pixels in units of `scale`). */
	density: number;
	minLength: number;
	maxLength: number;
	stroke: number;
	/** The share of strokes that bend into a circuit trace ending in a pad. */
	traces: number;
	/** A circle (x, y, r) the rain stays out of: the mark's. */
	avoid?: { x: number; y: number; r: number };
}

/**
 * Rain like the mark's: strokes at 45°, up to the right, fading towards the top (where a phone's clock is). Some turn
 * into a circuit trace, as the mark's last line does, and end in a pad. Lengths and strokes are in units of `scale`.
 */
function rain(screen: Screen, scale: number, options: RainOptions): string {
	const { width, height } = screen;
	const next = random(options.seed);
	// By the screen's area in units of `scale` (a phone's pixels), so the rain looks the same at any resolution: a 5K
	// screen draws as many strokes as a 4K one, each bigger. A landscape screen is seen from further away, so it rains
	// harder.
	const area = (width * height) / scale ** 2 / 1e6;
	const count = Math.round(area * options.density * (height > width ? 1 : LANDSCAPE_RAIN));
	// Strokes by tile, each tile glowing on its own: one glow over a whole 4K or 5K screen is more than Chrome draws.
	const tiles = new Map<string, string>();
	const add = (cx: number, cy: number, markup: string) => {
		const tile = `${Math.floor(cx / RAIN_TILE)},${Math.floor(cy / RAIN_TILE)}`;
		tiles.set(tile, (tiles.get(tile) ?? '') + markup);
	};
	for (let i = 0; i < count; i++) {
		const x = next() * (width + height * 0.6) - height * 0.3;
		const y = next() * height * 1.1;
		const length = (options.minLength + next() ** 2 * (options.maxLength - options.minLength)) * scale;
		const run = length / Math.SQRT2;
		const [x2, y2] = [x + run, y - run];
		const [cx, cy] = [(x + x2) / 2, (y + y2) / 2];
		const opacity = (0.1 + next() ** 1.6 * 0.55) * Math.min(1, 0.25 + (cy / height) * 1.4);
		const stroke = options.stroke * scale * (0.6 + next() * 0.7);
		const traced = next() < options.traces;
		const trace = (40 + next() * 160) * scale;
		const { avoid } = options;
		if (avoid && Math.hypot(cx - avoid.x, cy - avoid.y) < avoid.r) continue;
		const attributes = `stroke-width="${stroke.toFixed(2)}" opacity="${opacity.toFixed(3)}"`;
		if (traced) {
			const pad = 9 * scale;
			add(
				cx,
				cy,
				`<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}h${trace.toFixed(1)}" ${attributes}/>` +
					`<circle cx="${(x2 + trace + pad).toFixed(1)}" cy="${y2.toFixed(1)}" r="${pad.toFixed(1)}" ${attributes}/>`,
			);
		} else {
			add(
				cx,
				cy,
				`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${attributes}/>`,
			);
		}
	}
	const groups = [...tiles.values()].map((strokes) => `<g filter="url(#bloom)">${strokes}</g>`).join('');
	return `<g fill="none" stroke="url(#screen)" stroke-linecap="round" stroke-linejoin="round">${groups}</g>`;
}

/** The mark at (x, y), `size` pixels across its circle, glowing: a wide halo, a bloom, the line, a white-hot core. */
function glowingMark(x: number, y: number, size: number, stroke: number): string {
	const scale = size / 92;
	return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})">
		<g filter="url(#halo)" opacity=".75">${markStrokes(stroke * 3, GRADIENT, 'mark-halo')}</g>
		<g filter="url(#soft)" opacity=".95">${markStrokes(stroke * 2.2, GRADIENT, 'mark-soft')}</g>
		${markStrokes(stroke, GRADIENT, 'mark-line')}
		<g opacity=".35">${markStrokes(stroke * 0.35, { from: '#ffffff', to: '#ffffff' }, 'mark-core')}</g>
	</g>`;
}

/** The two colours as faint ambient light: peach at (fx, fy), teal at (tx, ty), each `r` pixels across. */
function ambient(fx: number, fy: number, fr: number, tx: number, ty: number, tr: number): string {
	return `<ellipse cx="${fx}" cy="${fy}" rx="${fr}" ry="${fr * 1.2}" fill="url(#ambient-from)"/>
		<ellipse cx="${tx}" cy="${ty}" rx="${tr}" ry="${tr * 1.2}" fill="url(#ambient-to)"/>`;
}

const DESIGNS = {
	/** The mark, large and glowing, below a phone's clock or in the middle of a desktop, in a light rain. */
	halo: (screen: Screen, portrait: boolean, scale: number) => {
		const { width: w, height: h } = screen;
		const [x, y, size] = portrait ? [w / 2, h * 0.58, w * 0.66] : [w / 2, h * 0.52, h * 0.6];
		return `${portrait ? ambient(w * 0.2, h * 0.45, w * 0.55, w * 0.85, h * 0.72, w * 0.6) : ambient(w * 0.3, h * 0.4, h * 0.75, w * 0.7, h * 0.65, h * 0.8)}
			${rain(screen, scale, { seed: 11, density: 19, minLength: 60, maxLength: 380, stroke: 3, traces: 0.08, avoid: { x, y, r: size * 0.64 } })}
			${glowingMark(x, y, size, 1.25)}`;
	},
	/** Rain and circuit traces over the whole screen, denser lower down, the mark small near the bottom. */
	storm: (screen: Screen, portrait: boolean, scale: number) => {
		const { width: w, height: h } = screen;
		const [x, y, size] = portrait ? [w / 2, h * 0.83, w * 0.2] : [w * 0.82, h * 0.74, h * 0.16];
		return `${portrait ? ambient(w * 0.1, h * 0.35, w * 0.6, w * 0.95, h * 0.88, w * 0.7) : ambient(w * 0.15, h * 0.3, h * 0.8, w * 0.9, h * 0.85, h * 0.9)}
			${rain(screen, scale, { seed: 5, density: 83, minLength: 40, maxLength: 900, stroke: 3.4, traces: 0.12 })}
			${glowingMark(x, y, size, 2.2)}`;
	},
	/** A slice of a huge mark sweeping off the right edge, its rain lines and trace crossing the screen. */
	eclipse: (screen: Screen, portrait: boolean, scale: number) => {
		const { width: w, height: h } = screen;
		const [x, y, size] = portrait ? [w * 0.78, h * 0.66, w * 1.7] : [w * 0.78, h * 0.62, h * 1.9];
		return `${portrait ? ambient(w * 0.3, h * 0.45, w * 0.55, w * 0.95, h * 0.8, w * 0.65) : ambient(w * 0.4, h * 0.35, h * 0.7, w * 0.92, h * 0.8, h * 0.85)}
			${rain(screen, scale, { seed: 23, density: 14, minLength: 60, maxLength: 300, stroke: 2.6, traces: 0.1 })}
			${glowingMark(x, y, size, 0.7)}`;
	},
};

/**
 * The widest page Chrome draws whole, in pixels: past it (a 5K screen), parts of the glow and the mark go missing, so
 * a wider screen is drawn as a page half its size at twice the pixel density, the same pixels in the end.
 */
const MAX_PAGE_WIDTH = 4096;

const pixelDensity = (screen: Screen) => (screen.width > MAX_PAGE_WIDTH ? 2 : 1);

/** A design on a screen, as a standalone SVG. */
function wallpaper(design: keyof typeof DESIGNS, screen: Screen): string {
	const { width: w, height: h } = screen;
	const portrait = h > w;
	// Lengths and strokes were drawn for a phone 1290 pixels wide; a screen's short side scales them.
	const scale = Math.min(w, h) / 1290;
	const grain = `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>`;
	// Drawn at 1/`density` of its size, for Chrome to draw at `density` pixels per point (`MAX_PAGE_WIDTH`).
	const density = pixelDensity(screen);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w / density}" height="${h / density}" viewBox="0 0 ${w} ${h}"><defs>
		<linearGradient id="screen" gradientUnits="userSpaceOnUse" x1="0" y1="${h * 0.15}" x2="${w}" y2="${h * 0.85}"><stop offset="0" stop-color="${GRADIENT.from}"/><stop offset="1" stop-color="${GRADIENT.to}"/></linearGradient>
		<radialGradient id="ambient-from"><stop offset="0" stop-color="${GRADIENT.from}" stop-opacity=".2"/><stop offset="1" stop-color="${GRADIENT.from}" stop-opacity="0"/></radialGradient>
		<radialGradient id="ambient-to"><stop offset="0" stop-color="${GRADIENT.to}" stop-opacity=".26"/><stop offset="1" stop-color="${GRADIENT.to}" stop-opacity="0"/></radialGradient>
		<radialGradient id="vignette" cx=".5" cy=".55" r=".8"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
		<filter id="bloom" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="${(7 * scale).toFixed(1)}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
		<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
		<filter id="halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
		${grain}
	</defs>
	<rect width="${w}" height="${h}" fill="${BACKGROUND}"/>
	${DESIGNS[design](screen, portrait, scale)}
	<rect width="${w}" height="${h}" fill="url(#vignette)"/>
	<rect width="${w}" height="${h}" filter="url(#grain)"/>
</svg>`;
}

mkdirSync(output, { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), 'raineworks-wallpapers-'));
try {
	for (const design of Object.keys(DESIGNS) as (keyof typeof DESIGNS)[]) {
		for (const screen of SCREENS) {
			const name = `raineworks-${design}-${screen.name}-${screen.width}x${screen.height}.png`;
			if (only && !name.includes(only)) continue;
			const html = join(workDir, `${design}-${screen.name}.html`);
			await Bun.write(
				html,
				`<!doctype html><body style="margin:0;background:${BACKGROUND}">${wallpaper(design, screen)}`,
			);
			const file = join(output, name);
			const run = Bun.spawnSync([
				chrome,
				'--headless=new',
				'--no-sandbox',
				'--hide-scrollbars',
				// Room to draw a 5K screen's glow whole: by default Chrome runs out and leaves its last tiles unfiltered.
				'--force-gpu-mem-available-mb=4096',
				`--force-device-scale-factor=${pixelDensity(screen)}`,
				`--window-size=${screen.width / pixelDensity(screen)},${screen.height / pixelDensity(screen)}`,
				'--virtual-time-budget=30000',
				`--screenshot=${file}`,
				Bun.pathToFileURL(html).href,
			]);
			if (run.exitCode !== 0)
				throw new Error(`Chrome failed on ${design} for ${screen.name}: ${run.stderr.toString()}`);
			console.log(`✅ ${file}`);
		}
	}
} finally {
	rmSync(workDir, { recursive: true, force: true });
}
