/**
 * The pieces screens are built from: a `Card` (a bordered panel with an optional title), a `Heading` with its small
 * label, and `Chip`s.
 *
 * @module ui/panel
 */

import { theme } from '@raineworks/ssh/theme';
import type { ReactNode } from 'react';

export function Card({
	title,
	children,
	grow,
	accent,
}: {
	title?: string;
	children: ReactNode;
	grow?: boolean;
	accent?: boolean;
}) {
	return (
		<box
			title={title ? ` ${title} ` : undefined}
			titleColor={accent ? theme.accent : theme.muted}
			style={{
				flexDirection: 'column',
				flexGrow: grow ? 1 : 0,
				border: true,
				borderStyle: 'rounded',
				borderColor: accent ? theme.accentStrong : theme.border,
				backgroundColor: theme.panel,
				paddingLeft: 1,
				paddingRight: 1,
			}}
		>
			{children}
		</box>
	);
}

/** A screen's heading: a small label over its title. */
export function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
	return (
		<box style={{ flexDirection: 'column', marginBottom: 1 }}>
			<text fg={theme.dim}>{eyebrow.toUpperCase().split('').join(' ')}</text>
			<text>
				<strong fg={theme.text}>{title}</strong>
			</text>
		</box>
	);
}

/** Tags, as one line of chips. */
export function Chips({ items }: { items: readonly string[] }) {
	return (
		<text>
			{items.map((item, i) => (
				<span key={item}>
					<span bg={theme.raised} fg={theme.muted}>{` ${item} `}</span>
					{i < items.length - 1 ? ' ' : ''}
				</span>
			))}
		</text>
	);
}
