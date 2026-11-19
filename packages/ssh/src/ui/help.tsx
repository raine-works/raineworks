/**
 * The keys, all of them (`?`; esc closes).
 *
 * @module ui/help
 */

import { useKeyboard } from '@opentui/react';
import { theme } from '@raineworks/ssh/theme';

const KEYS: Array<[string, string]> = [
	['← → · h l · tab', 'Previous / next screen'],
	['1 – 6', 'Jump to a screen'],
	['↑ ↓ · j k', 'Move through a list (Projects)'],
	['enter · i', 'Start typing (Contact)'],
	['⌃S', 'Send the message (Contact)'],
	['⌃K · :', 'Command palette'],
	['r', 'Rain on / off'],
	['mouse', 'Click anything; scroll the page'],
	['q · ⌃C', 'Quit'],
];

export function Help({ width, onClose }: { width: number; onClose: () => void }) {
	useKeyboard((key) => {
		if (key.name === 'escape' || key.name === 'q' || key.sequence === '?') onClose();
	});
	const boxWidth = Math.min(60, width - 4);
	return (
		<box
			title=" Keys "
			titleColor={theme.accent}
			style={{
				position: 'absolute',
				top: 3,
				left: Math.floor((width - boxWidth) / 2),
				width: boxWidth,
				zIndex: 20,
				flexDirection: 'column',
				border: true,
				borderStyle: 'rounded',
				borderColor: theme.accent,
				backgroundColor: theme.panel,
				paddingLeft: 2,
				paddingRight: 2,
				paddingTop: 1,
				paddingBottom: 1,
			}}
		>
			{KEYS.map(([keys, what]) => (
				<text key={keys}>
					<span fg={theme.accent}>{keys.padEnd(18)}</span>
					<span fg={theme.muted}>{what}</span>
				</text>
			))}
			<box style={{ height: 1 }} />
			<text fg={theme.faint}>esc closes</text>
		</box>
	);
}
