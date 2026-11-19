/**
 * The hobbies screen.
 *
 * @module screens/hobbies
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { Heading } from '@raineworks/ssh/screens/section';
import { hobbies } from '@raineworks/web-marketing/content/profile';
import { Box, Text } from 'ink';

export function Hobbies() {
	return (
		<Box flexDirection="column" gap={1}>
			{hobbies.map((hobby) => (
				<Box key={hobby.name} flexDirection="column">
					<Heading>{hobby.name}</Heading>
					<Text>{sanitize(hobby.note)}</Text>
				</Box>
			))}
		</Box>
	);
}
