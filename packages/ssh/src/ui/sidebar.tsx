/**
 * The screens as a sidebar: each with its number key and glyph, the current one marked in the accent. Every row is a
 * mouse target. On a narrow terminal the app shows `Tabs` instead.
 *
 * @module ui/sidebar
 */

import { theme } from '@raineworks/ssh/theme';
import { type ScreenId, SCREENS } from '@raineworks/ssh/ui/screens';

/** The sidebar's width, borders included. */
export const SIDEBAR_WIDTH = 24;

export function Sidebar({ current, onPick }: { current: ScreenId; onPick: (id: ScreenId) => void }) {
	return (
		<box
			style={{
				width: SIDEBAR_WIDTH,
				flexDirection: 'column',
				backgroundColor: theme.panel,
				border: ['right'],
				borderColor: theme.border,
				paddingTop: 1,
			}}
		>
			{SCREENS.map((screen, index) => {
				const active = screen.id === current;
				return (
					<box
						key={screen.id}
						onMouseDown={() => onPick(screen.id)}
						style={{ height: 1, flexDirection: 'row', backgroundColor: active ? theme.raised : undefined }}
					>
						<text>
							<span fg={active ? theme.accent : theme.panel}>▌</span>
							<span fg={theme.faint}>{` ${index + 1} `}</span>
							<span fg={active ? theme.accent : theme.dim}>{`${screen.glyph} `}</span>
							{active ? <strong fg={theme.text}>{screen.label}</strong> : <span fg={theme.muted}>{screen.label}</span>}
						</text>
					</box>
				);
			})}
			<box style={{ flexGrow: 1 }} />
			<box style={{ flexDirection: 'column', paddingLeft: 2, paddingBottom: 1 }}>
				<text fg={theme.faint}>
					<span fg={theme.dim}>⌃K</span> palette
				</text>
				<text fg={theme.faint}>
					<span fg={theme.dim}>?</span> help · <span fg={theme.dim}>q</span> quit
				</text>
			</box>
		</box>
	);
}

/** The screens as one row of tabs, for a terminal too narrow for the sidebar. */
export function Tabs({ current, onPick }: { current: ScreenId; onPick: (id: ScreenId) => void }) {
	return (
		<box style={{ flexDirection: 'row', height: 1, paddingLeft: 1, backgroundColor: theme.panel, gap: 1 }}>
			{SCREENS.map((screen, index) => {
				const active = screen.id === current;
				return (
					<box key={screen.id} onMouseDown={() => onPick(screen.id)}>
						<text bg={active ? theme.raised : undefined} fg={active ? theme.accent : theme.dim}>
							{` ${index + 1} ${screen.label} `}
						</text>
					</box>
				);
			})}
		</box>
	);
}
