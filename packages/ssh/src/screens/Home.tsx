import { profile } from '@web/content/profile';
import { Box, Text } from 'ink';
import { sanitize } from '@/sanitize';
import { Block, Dim, Heading } from '@/screens/Section';

export function Home() {
	return (
		<Box flexDirection="column">
			<Block>
				<Heading>{profile.name}</Heading>
				<Text>{sanitize(profile.title)}</Text>
				<Dim>{profile.location}</Dim>
			</Block>
			<Block>
				<Text>{sanitize(profile.tagline)}</Text>
			</Block>
			<Text>{sanitize(profile.bio)}</Text>
		</Box>
	);
}
