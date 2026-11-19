/**
 * Rain, falling the way the logo's lines run (down and to the left, `╱`), drawn as text: each drop a bright head and a
 * fading trail. Deterministic for a given size and seed (so tests see the same frame), and animated at about 12 frames
 * a second while it's shown; `still` holds it on one frame.
 *
 * @module ui/rain
 */

import { theme } from '@raineworks/ssh/theme';
import { useEffect, useState } from 'react';

/** How often the rain moves. */
const FRAME_MS = 85;

interface Drop {
	/** Where its head starts, along the diagonal it falls on. */
	column: number;
	/** How far into its fall it is at frame 0. */
	offset: number;
	/** How many cells of trail follow its head. */
	length: number;
	/** Cells it falls per frame (1 or 2: near drops fall faster). */
	speed: number;
}

/** A small seeded random number generator (mulberry32): the same rain for the same seed. */
function random(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Drops for a field of `width` × `height`: about one cell in `1 / density` is part of one. */
export function makeDrops(width: number, height: number, density: number, seed = 7): Drop[] {
	const next = random(seed);
	const count = Math.max(1, Math.round((width * height * density) / 4));
	return Array.from({ length: count }, () => ({
		column: Math.floor(next() * (width + height)),
		offset: Math.floor(next() * (height * 2)),
		length: 2 + Math.floor(next() * 5),
		speed: next() < 0.3 ? 2 : 1,
	}));
}

/**
 * The field at `frame`, as rows of intensities: 0 is empty, 1–4 a drop's trail to its head. A drop's head moves one
 * cell down and one to the left a step, so it falls along `╱`.
 */
export function rainField(drops: Drop[], width: number, height: number, frame: number): number[][] {
	const field = Array.from({ length: height }, () => new Array<number>(width).fill(0));
	for (const drop of drops) {
		const cycle = height + drop.length;
		const head = (drop.offset + frame * drop.speed) % cycle;
		for (let back = 0; back <= drop.length; back++) {
			const y = head - back;
			const x = drop.column - y;
			if (y < 0 || y >= height || x < 0 || x >= width) continue;
			const row = field[y] as number[];
			const level = back === 0 ? 4 : Math.max(1, 3 - Math.floor((back * 3) / (drop.length + 1)));
			row[x] = Math.max(row[x] ?? 0, level);
		}
	}
	return field;
}

/** A row as runs of one intensity, so each is one span. */
function runs(row: number[]): Array<{ level: number; text: string }> {
	const out: Array<{ level: number; text: string }> = [];
	for (const level of row) {
		const char = level === 0 ? ' ' : '╱';
		const last = out.at(-1);
		if (last && last.level === level) last.text += char;
		else out.push({ level, text: char });
	}
	return out;
}

export function Rain({
	width,
	height,
	density = 0.08,
	still = false,
	seed,
}: {
	width: number;
	height: number;
	density?: number;
	still?: boolean;
	seed?: number;
}) {
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		if (still) return;
		const timer = setInterval(() => setFrame((current) => current + 1), FRAME_MS);
		return () => clearInterval(timer);
	}, [still]);
	const drops = makeDrops(width, height, density, seed);
	const field = rainField(drops, width, height, frame);
	return (
		<box style={{ flexDirection: 'column', width, height }}>
			{field.map((row, y) => (
				<text key={y}>
					{runs(row).map((run, i) =>
						run.level === 0 ? (
							<span key={i}>{run.text}</span>
						) : (
							<span key={i} fg={theme.rain[run.level - 1]}>
								{run.text}
							</span>
						),
					)}
				</text>
			))}
		</box>
	);
}
