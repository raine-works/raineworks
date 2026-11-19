/**
 * The pieces every screen is built from: `Heading`, `Dim` text and a spaced `Block`.
 *
 * @module screens/section
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export function Heading({ children }: { children: string }) {
	return (
		<Text bold color={theme.accent}>
			{sanitize(children)}
		</Text>
	);
}

export function Dim({ children }: { children: string }) {
	return <Text color={theme.dim}>{sanitize(children)}</Text>;
}

export function Block({ children }: { children: ReactNode }) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			{children}
		</Box>
	);
}
