import { hobbies } from '@marketing/content/profile';
import { Box, Text } from 'ink';
import { sanitize } from '@/sanitize';
import { Heading } from '@/screens/Section';

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
