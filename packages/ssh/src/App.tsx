import { profile } from '@web/content/profile';
import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useState } from 'react';
import { sanitize } from '@/sanitize';
import { Contact } from '@/screens/Contact';
import { Hobbies } from '@/screens/Hobbies';
import { Home } from '@/screens/Home';
import { Projects } from '@/screens/Projects';
import { Work } from '@/screens/Work';
import { theme } from '@/theme';

const SCREENS = [
	{ id: 'home', Component: Home },
	{ id: 'work', Component: Work },
	{ id: 'projects', Component: Projects },
	{ id: 'hobbies', Component: Hobbies },
	{ id: 'contact', Component: Contact },
] as const;

export function App() {
	const { exit } = useApp();
	const { columns } = useWindowSize();
	const [index, setIndex] = useState(0);

	useInput((input, key) => {
		if (input === 'q' || (key.ctrl && input === 'c')) {
			exit();
			return;
		}
		if (key.rightArrow || key.tab || input === 'l') setIndex((i) => (i + 1) % SCREENS.length);
		if (key.leftArrow || (key.shift && key.tab) || input === 'h')
			setIndex((i) => (i - 1 + SCREENS.length) % SCREENS.length);
		const jump = Number.parseInt(input, 10);
		if (jump >= 1 && jump <= SCREENS.length) setIndex(jump - 1);
	});

	const width = Math.max(20, Math.min(columns || 80, 100));
	const { Component } = SCREENS[index] ?? SCREENS[0];

	return (
		<Box flexDirection="column" width={width} paddingX={1}>
			<Text bold color={theme.accent}>{`~/${sanitize(profile.name.toLowerCase().replace(/\s+/g, '-'))}`}</Text>
			<Box marginY={1} columnGap={2} flexWrap="wrap">
				{SCREENS.map((screen, i) => (
					<Text key={screen.id} inverse={i === index} color={i === index ? theme.accent : theme.dim}>
						{` ${i + 1} ${screen.id} `}
					</Text>
				))}
			</Box>
			<Component />
			<Box marginTop={1}>
				<Text color={theme.dim}>←/→ or h/l navigate · 1-5 jump · q quit</Text>
			</Box>
		</Box>
	);
}
