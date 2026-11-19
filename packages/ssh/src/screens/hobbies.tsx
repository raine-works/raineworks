/**
 * Hobbies: a card each, laid out in as many columns as the terminal fits.
 *
 * @module screens/hobbies
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Heading } from '@raineworks/ssh/ui/panel';
import { hobbies } from '@raineworks/web-marketing/content/profile';

const GLYPHS: Record<string, string> = {
	Homelab: '▦',
	'Software development': '</>',
	Tinkering: '⚙',
	'Video games': '▶',
	Golf: '⚑',
	Motorcycles: '◎',
	Cars: '▣',
};

/** A card's width; as many fit side by side as the content area has room for. */
const CARD_WIDTH = 34;

export function Hobbies({ width }: { width: number }) {
	const columns = Math.max(1, Math.floor((width - 4) / (CARD_WIDTH + 1)));
	const rows = Array.from({ length: Math.ceil(hobbies.length / columns) }, (_, r) =>
		hobbies.slice(r * columns, r * columns + columns),
	);
	return (
		<box style={{ flexDirection: 'column', padding: 1, paddingLeft: 2 }}>
			<Heading eyebrow="hobbies" title="Away from the keyboard (and at it)" />
			{rows.map((row, r) => (
				<box key={r} style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
					{row.map((hobby) => (
						<box
							key={hobby.name}
							style={{
								width: CARD_WIDTH,
								flexDirection: 'column',
								border: true,
								borderStyle: 'rounded',
								borderColor: theme.border,
								backgroundColor: theme.panel,
								paddingLeft: 1,
								paddingRight: 1,
							}}
						>
							<text>
								<span fg={theme.accent}>{`${GLYPHS[hobby.name] ?? '•'}  `}</span>
								<strong fg={theme.text}>{sanitize(hobby.name)}</strong>
							</text>
							<text fg={theme.muted} wrapMode="word">
								{sanitize(hobby.note)}
							</text>
						</box>
					))}
				</box>
			))}
		</box>
	);
}
