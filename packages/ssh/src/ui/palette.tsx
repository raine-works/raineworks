/**
 * The command palette (⌃K or `:`): type to filter, ↑/↓ to choose, enter to run, esc to close. Every screen, and the
 * app's actions, are in it.
 *
 * @module ui/palette
 */

import { useKeyboard } from '@opentui/react';
import { theme } from '@raineworks/ssh/theme';
import '@raineworks/tools/prototypes';
import { useState } from 'react';

export interface Command {
	id: string;
	label: string;
	hint: string;
	run: () => void;
}

/** Where `word` appears in a command's label: matches in the label first, the earlier the better; hint-only last. */
const rank = (command: Command, word: string) => {
	const at = command.label.toLowerCase().indexOf(word);
	return at === -1 ? Number.POSITIVE_INFINITY : at;
};

/** Commands whose label or hint holds every word typed: those matching in the label first, earliest first. */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.isEmpty()) return [...commands];
	return commands
		.filter((command) => {
			const haystack = `${command.label} ${command.hint}`.toLowerCase();
			return words.every((word) => haystack.includes(word));
		})
		.sort((a, b) => rank(a, words[0] ?? '') - rank(b, words[0] ?? ''));
}

export function Palette({
	commands,
	width,
	onClose,
}: {
	commands: readonly Command[];
	width: number;
	onClose: () => void;
}) {
	const [query, setQuery] = useState('');
	const [index, setIndex] = useState(0);
	const found = filterCommands(commands, query);
	const chosen = Math.min(index, Math.max(0, found.length - 1));
	const run = (command: Command | undefined) => {
		if (!command) return;
		onClose();
		command.run();
	};
	useKeyboard((key) => {
		if (key.name === 'escape') onClose();
		else if (key.name === 'down' || (key.ctrl && key.name === 'n')) setIndex((chosen + 1) % Math.max(1, found.length));
		else if (key.name === 'up' || (key.ctrl && key.name === 'p'))
			setIndex((chosen - 1 + found.length) % Math.max(1, found.length));
		else if (key.name === 'return') run(found[chosen]);
	});
	const boxWidth = Math.min(64, width - 4);
	return (
		<box
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
				padding: 1,
			}}
			title=" Command palette "
			titleColor={theme.accent}
		>
			<box style={{ height: 1, flexDirection: 'row' }}>
				<text fg={theme.accent}>{'› '}</text>
				<input
					focused
					value={query}
					placeholder="Type a command…"
					onInput={(value: string) => {
						setQuery(value);
						setIndex(0);
					}}
					style={{
						flexGrow: 1,
						backgroundColor: theme.panel,
						focusedBackgroundColor: theme.panel,
						textColor: theme.text,
					}}
				/>
			</box>
			<box style={{ height: 1 }} />
			{found.isEmpty() ? (
				<text fg={theme.dim}>Nothing matches “{query}”.</text>
			) : (
				found.map((command, i) => (
					<box
						key={command.id}
						onMouseDown={() => run(command)}
						style={{ height: 1, flexDirection: 'row', backgroundColor: i === chosen ? theme.raised : undefined }}
					>
						<text>
							<span fg={i === chosen ? theme.accent : theme.panel}>▌ </span>
							<span fg={i === chosen ? theme.text : theme.muted}>{command.label}</span>
							<span fg={theme.faint}>{`  ${command.hint}`}</span>
						</text>
					</box>
				))
			)}
		</box>
	);
}
