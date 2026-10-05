import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { sanitize } from '@/sanitize';
import { theme } from '@/theme';

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
