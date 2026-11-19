/**
 * The terminal UI, one per SSH session: a header, the screens (a sidebar, or tabs when narrow), a status bar, and two
 * overlays: the command palette (⌃K or `:`) and the keys (`?`). The keys belong to the mode: in `nav` they move between
 * screens; in `form` the contact form has them; an open overlay owns them. ⌃C always quits.
 *
 * Content is the site's (`@raineworks/web-marketing/content/profile`), through `sanitize`. Messages go through
 * `send`, which the server gives (the site's API); tests give their own.
 *
 * @module app
 */

import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { About } from '@raineworks/ssh/screens/about';
import { Contact, type SendMessage } from '@raineworks/ssh/screens/contact';
import { Hobbies } from '@raineworks/ssh/screens/hobbies';
import { Home } from '@raineworks/ssh/screens/home';
import { Projects } from '@raineworks/ssh/screens/projects';
import { Work } from '@raineworks/ssh/screens/work';
import { theme } from '@raineworks/ssh/theme';
import { Header } from '@raineworks/ssh/ui/header';
import { Help } from '@raineworks/ssh/ui/help';
import { type Command, Palette } from '@raineworks/ssh/ui/palette';
import { type Mode, type ScreenId, SCREENS } from '@raineworks/ssh/ui/screens';
import { Sidebar, SIDEBAR_WIDTH, Tabs } from '@raineworks/ssh/ui/sidebar';
import { StatusBar } from '@raineworks/ssh/ui/status-bar';
import { projects } from '@raineworks/web-marketing/content/profile';
import { useState } from 'react';

export type { SendMessage };

/** The smallest terminal the app lays out in; smaller shows how much bigger it needs to be. */
export const MIN_SIZE = { width: 60, height: 20 } as const;
/** Narrower than this, the sidebar gives way to a row of tabs. */
const SIDEBAR_FROM = 96;

const indexOf = (id: ScreenId) => SCREENS.findIndex((screen) => screen.id === id);

export function App({
	version,
	send,
	onQuit,
	rain: initialRain = true,
}: {
	version: string;
	send: SendMessage;
	onQuit: () => void;
	/** Whether the rain falls at first (tests hold it still). */
	rain?: boolean;
}) {
	const { width, height } = useTerminalDimensions();
	const [screen, setScreen] = useState<ScreenId>('home');
	const [mode, setMode] = useState<Mode>('nav');
	const [rain, setRain] = useState(initialRain);
	const [project, setProject] = useState(0);

	const go = (id: ScreenId) => {
		setScreen(id);
		setMode('nav');
	};
	const step = (by: number) => {
		const next = SCREENS[(indexOf(screen) + by + SCREENS.length) % SCREENS.length];
		if (next) go(next.id);
	};

	const commands: Command[] = [
		...SCREENS.map((each) => ({
			id: `go:${each.id}`,
			label: `Go to ${each.label}`,
			hint: each.hint,
			run: () => go(each.id),
		})),
		{ id: 'write', label: 'Write a message', hint: 'Contact', run: () => (setScreen('contact'), setMode('form')) },
		{ id: 'rain', label: rain ? 'Stop the rain' : 'Start the rain', hint: 'r', run: () => setRain((on) => !on) },
		{ id: 'help', label: 'Show the keys', hint: '?', run: () => setMode('help') },
		{ id: 'quit', label: 'Quit', hint: 'q', run: onQuit },
	];

	useKeyboard((key) => {
		if (key.ctrl && key.name === 'c') return onQuit();
		if (mode !== 'nav') return;
		if (key.name === 'q') onQuit();
		else if ((key.ctrl && key.name === 'k') || key.sequence === ':') setMode('palette');
		else if (key.sequence === '?') setMode('help');
		else if (key.name === 'r') setRain((on) => !on);
		else if (key.name === 'right' || key.name === 'l' || (key.name === 'tab' && !key.shift)) step(1);
		else if (key.name === 'left' || key.name === 'h' || (key.name === 'tab' && key.shift)) step(-1);
		else if (/^[1-6]$/.test(key.sequence)) {
			const target = SCREENS[Number(key.sequence) - 1];
			if (target) go(target.id);
		} else if (screen === 'projects' && (key.name === 'down' || key.name === 'j'))
			setProject((current) => (current + 1) % projects.length);
		else if (screen === 'projects' && (key.name === 'up' || key.name === 'k'))
			setProject((current) => (current - 1 + projects.length) % projects.length);
		else if (screen === 'contact' && (key.name === 'return' || key.name === 'i')) setMode('form');
	});

	if (width < MIN_SIZE.width || height < MIN_SIZE.height) {
		return (
			<box
				style={{
					width,
					height,
					backgroundColor: theme.bg,
					alignItems: 'center',
					justifyContent: 'center',
					flexDirection: 'column',
				}}
			>
				<text fg={theme.accent}>╱╱╱─○ raineworks</text>
				<text
					fg={theme.muted}
				>{`Make the window a little bigger: ${MIN_SIZE.width}×${MIN_SIZE.height} at least.`}</text>
				<text fg={theme.dim}>{`It's ${width}×${height} now · q quits`}</text>
			</box>
		);
	}

	const withSidebar = width >= SIDEBAR_FROM;
	const contentWidth = withSidebar ? width - SIDEBAR_WIDTH : width;
	const current = SCREENS[indexOf(screen)] ?? SCREENS[0];
	return (
		<box style={{ width, height, flexDirection: 'column', backgroundColor: theme.bg }}>
			<Header title={current.label} width={width} height={height} />
			{!withSidebar && <Tabs current={screen} onPick={go} />}
			<box style={{ flexDirection: 'row', flexGrow: 1 }}>
				{withSidebar && <Sidebar current={screen} onPick={go} />}
				<scrollbox key={screen} style={{ flexGrow: 1, rootOptions: { backgroundColor: theme.bg } }}>
					{screen === 'home' && <Home width={contentWidth - 2} rain={rain} />}
					{screen === 'work' && <Work />}
					{screen === 'projects' && <Projects index={project} onPick={setProject} width={contentWidth} />}
					{screen === 'hobbies' && <Hobbies width={contentWidth} />}
					{screen === 'contact' && <Contact mode={mode} onMode={setMode} send={send} width={contentWidth} />}
					{screen === 'about' && <About version={version} width={width} height={height} />}
				</scrollbox>
			</box>
			<StatusBar mode={mode} version={version} />
			{mode === 'palette' && <Palette commands={commands} width={width} onClose={() => setMode('nav')} />}
			{mode === 'help' && <Help width={width} onClose={() => setMode('nav')} />}
		</box>
	);
}
