import { education, work } from '@marketing/content/profile';
import { Box, Text } from 'ink';
import { sanitize } from '@/sanitize';
import { Block, Dim, Heading } from '@/screens/Section';

export function Work() {
	return (
		<Box flexDirection="column">
			{work.map((entry) => (
				<Block key={`${entry.org}-${entry.period}`}>
					<Heading>{`${entry.role} @ ${entry.org}`}</Heading>
					<Dim>{`${entry.period}  ${entry.href}`}</Dim>
					<Text>{sanitize(entry.summary)}</Text>
				</Block>
			))}
			<Heading>education</Heading>
			{education.map((entry) => (
				<Box key={entry.school} flexDirection="column">
					<Text>{sanitize(`${entry.school} (${entry.period})`)}</Text>
					<Dim>{entry.focus}</Dim>
				</Box>
			))}
		</Box>
	);
}
