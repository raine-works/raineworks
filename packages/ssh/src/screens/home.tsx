/**
 * Home: the logo, as the site's lockup (the mark, `ui/logo`, then the name in big ASCII letters) over falling rain;
 * who Raine is, what Raine is building now, and the featured projects. The title takes the largest font that fits
 * beside the mark (`titleFont`); too narrow for both, the mark gives way.
 *
 * @module screens/home
 */

import { measureText } from '@opentui/core';
import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Logo } from '@raineworks/ssh/ui/logo';
import { Card, Chips } from '@raineworks/ssh/ui/panel';
import { Rain } from '@raineworks/ssh/ui/rain';
import { profile, projects, work } from '@raineworks/web-marketing/content/profile';

const TITLE = 'raineworks';
/** The title's fonts, largest first. */
const TITLE_FONTS = ['block', 'slick', 'tiny'] as const;

/** The largest font the title fits in `width` with (a margin either side), and its size. */
export function titleFont(width: number) {
	for (const font of TITLE_FONTS) {
		const size = measureText({ text: TITLE, font });
		if (size.width + 4 <= width) return { font, ...size };
	}
	return { font: 'tiny' as const, ...measureText({ text: TITLE, font: 'tiny' }) };
}

/** The mark's width in the hero (and so its height, half that). */
const MARK_COLS = 24;
/** Between the mark and the title. */
const MARK_GAP = 3;

export function Home({ width, rain }: { width: number; rain: boolean }) {
	const wide = width >= 70;
	// The lockup if the smallest title fits beside the mark; the title alone otherwise.
	const withMark = width >= MARK_COLS + MARK_GAP + 4 + measureText({ text: TITLE, font: 'tiny' }).width + 4;
	const title = titleFont(withMark ? width - MARK_COLS - MARK_GAP - 2 : width);
	const heroHeight = withMark ? MARK_COLS / 2 + 2 : title.height + 2;
	const titleLeft = withMark ? 2 + MARK_COLS + MARK_GAP : 2;
	const featured = projects.filter((project) => project.featured);
	return (
		<box style={{ flexDirection: 'column', gap: 1 }}>
			<box style={{ height: heroHeight, width }}>
				{rain && (
					<box style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
						<Rain width={width} height={heroHeight} />
					</box>
				)}
				{withMark && (
					<box style={{ position: 'absolute', top: 1, left: 2, zIndex: 1 }}>
						<Logo cols={MARK_COLS} />
					</box>
				)}
				<box
					style={{ position: 'absolute', top: Math.floor((heroHeight - title.height) / 2), left: titleLeft, zIndex: 1 }}
				>
					<ascii-font text={TITLE} font={title.font} color={[...theme.title]} />
				</box>
			</box>
			<box style={{ flexDirection: 'column', paddingLeft: 2, paddingRight: 2 }}>
				<text>
					<strong fg={theme.text}>{sanitize(profile.name)}</strong>
					<span fg={theme.faint}> · </span>
					<span fg={theme.muted}>{sanitize(profile.title)}</span>
				</text>
				<text fg={theme.dim}>{`⌖ ${sanitize(profile.location)}`}</text>
				<box style={{ height: 1 }} />
				<text fg={theme.text} wrapMode="word">
					{sanitize(profile.tagline)}
				</text>
				<text fg={theme.muted} wrapMode="word">
					{sanitize(profile.bio)}
				</text>
			</box>
			<box style={{ flexDirection: wide ? 'row' : 'column', gap: 1, paddingLeft: 1, paddingRight: 1 }}>
				{work.map((entry) => (
					<Card key={entry.org} title="now" grow>
						<text>
							<strong fg={theme.text}>{sanitize(entry.org)}</strong>
						</text>
						<text fg={theme.muted}>{sanitize(entry.role)}</text>
						<text fg={theme.dim}>{sanitize(entry.period)}</text>
					</Card>
				))}
			</box>
			<box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>
				<Card title="featured projects · 3 → projects">
					{featured.map((project) => (
						<box key={project.name} style={{ flexDirection: 'column', marginBottom: 1 }}>
							<text>
								<span fg={theme.accent}>★ </span>
								<strong fg={theme.text}>{sanitize(project.name)}</strong>
							</text>
							<text fg={theme.muted} wrapMode="word">
								{sanitize(project.description)}
							</text>
							<Chips items={project.stack.map(sanitize)} />
						</box>
					))}
				</Card>
			</box>
		</box>
	);
}
