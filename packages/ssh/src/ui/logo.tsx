/**
 * The raineworks mark, drawn in braille: its exact geometry (the circle, the three rain lines and the circuit trace with
 * its pad, from the logo's SVG, as `@raineworks/ui/blocks/brand` draws it) rasterised onto braille's 2×4 dots per
 * cell, so it's sharp at any size in any terminal. A cell is about twice as tall as it is wide, so a braille dot is
 * about square: the mark is `cols` wide and `cols / 2` tall.
 *
 * @module ui/logo
 */

import { theme } from '@raineworks/ssh/theme';

type Point = readonly [number, number];

/** The mark's strokes, in the SVG's units (centred on 0,0, the circle's radius 46). */
const SEGMENTS: ReadonlyArray<readonly [Point, Point]> = [
	// The rain lines.
	[
		[-22.98, -6.72],
		[-35.36, 5.66],
	],
	[
		[-2.83, -14.14],
		[-34.29, 17.32],
	],
	[
		[12.02, -16.26],
		[-30.05, 25.81],
	],
	// The circuit trace.
	[
		[-22.98, 31.47],
		[2.83, 5.66],
	],
	[
		[2.83, 5.66],
		[22.9, 5.66],
	],
];
const RINGS: ReadonlyArray<{ centre: Point; radius: number }> = [
	{ centre: [0, 0], radius: 46 },
	// The trace's pad.
	{ centre: [26.6, 5.66], radius: 3.7 },
];
/** The drawing's extent: the circle and its stroke. */
const EXTENT = 48;
/** The stroke, in units, as the SVG draws it large. */
const STROKE = 1.6;

/** The distance from `p` to the segment `a`–`b`. */
function toSegment(p: Point, [a, b]: readonly [Point, Point]): number {
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Whether the point `p` (in units) is on one of the mark's strokes, `half` wide either side. */
function onMark(p: Point, half: number): boolean {
	if (SEGMENTS.some((segment) => toSegment(p, segment) <= half)) return true;
	return RINGS.some(({ centre, radius }) => Math.abs(Math.hypot(p[0] - centre[0], p[1] - centre[1]) - radius) <= half);
}

/** Braille's dots in a cell, by column then row, as the bits of U+2800. */
const DOT_BITS = [
	[0x01, 0x02, 0x04, 0x40],
	[0x08, 0x10, 0x20, 0x80],
] as const;

/** The mark as rows of braille, `cols` cells wide (rounded to even) and half as tall. */
export function logoRows(cols: number): string[] {
	const width = Math.max(4, cols - (cols % 2));
	const rows = width / 2;
	const [dotsWide, dotsTall] = [width * 2, rows * 4];
	const unitsPerDot = (EXTENT * 2) / dotsWide;
	// At small sizes the SVG's hairline would vanish between dots: never thinner than about one dot.
	const half = Math.max(STROKE / 2, unitsPerDot * 0.55);
	const lines: string[] = [];
	for (let row = 0; row < rows; row++) {
		let line = '';
		for (let col = 0; col < width; col++) {
			let bits = 0;
			for (let dx = 0; dx < 2; dx++) {
				for (let dy = 0; dy < 4; dy++) {
					const x = (col * 2 + dx + 0.5) * unitsPerDot - EXTENT;
					const y = ((row * 4 + dy + 0.5) / dotsTall) * EXTENT * 2 - EXTENT;
					if (onMark([x, y], half)) bits |= DOT_BITS[dx]?.[dy] ?? 0;
				}
			}
			line += String.fromCharCode(0x2800 + bits);
		}
		lines.push(line);
	}
	return lines;
}

/** The mark, `cols` wide, shaded top to bottom with the title's gradient. */
export function Logo({ cols }: { cols: number }) {
	const rows = logoRows(cols);
	// Exactly its own size: a row that wrapped or was squeezed would break the drawing.
	return (
		<box style={{ flexDirection: 'column', width: [...(rows[0] ?? '')].length, flexShrink: 0 }}>
			{rows.map((line, i) => (
				<text
					key={i}
					wrapMode="none"
					fg={theme.title[Math.min(theme.title.length - 1, Math.floor((i / rows.length) * theme.title.length))]}
				>
					{line}
				</text>
			))}
		</box>
	);
}
