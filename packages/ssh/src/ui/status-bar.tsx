/**
 * The bottom bar: the mode (what the keys do now), the keys for it, and the version.
 *
 * @module ui/status-bar
 */

import { theme } from '@raineworks/ssh/theme';
import type { Mode } from '@raineworks/ssh/ui/screens';

const HINTS: Record<Mode, string> = {
	nav: '←/→ screens · 1–6 jump · ↑/↓ lists · ⌃K palette · r rain · ? help · q quit',
	form: 'tab next field · ⌃S send · esc leave the form',
	palette: '↑/↓ choose · enter run · esc close',
	help: 'esc close',
};

const BADGES: Record<Mode, { label: string; color: string }> = {
	nav: { label: 'NAV', color: theme.accent },
	form: { label: 'TYPE', color: theme.warning },
	palette: { label: 'RUN', color: theme.success },
	help: { label: 'HELP', color: theme.muted },
};

export function StatusBar({ mode, version }: { mode: Mode; version: string }) {
	const badge = BADGES[mode];
	return (
		<box style={{ flexDirection: 'row', height: 1, backgroundColor: theme.panel }}>
			<text bg={badge.color} fg={theme.bg}>
				<strong>{` ${badge.label} `}</strong>
			</text>
			<text fg={theme.dim}>{` ${HINTS[mode]}`}</text>
			<box style={{ flexGrow: 1 }} />
			<text fg={theme.faint}>{`v${version} `}</text>
		</box>
	);
}
