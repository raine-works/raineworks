/**
 * The home screen: name, title, location, tagline and bio.
 *
 * @module screens/home
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { Block, Dim, Heading } from '@raineworks/ssh/screens/section';
import { profile } from '@raineworks/web-marketing/content/profile';
import { Box, Text } from 'ink';

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
