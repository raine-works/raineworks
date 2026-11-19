/**
 * The work screen: experience, then education.
 *
 * @module screens/work
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { Block, Dim, Heading } from '@raineworks/ssh/screens/section';
import { education, work } from '@raineworks/web-marketing/content/profile';
import { Box, Text } from 'ink';

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
