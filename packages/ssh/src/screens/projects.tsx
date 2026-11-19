/**
 * The projects screen: each project's name, description and stack.
 *
 * @module screens/projects
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { Block, Dim, Heading } from '@raineworks/ssh/screens/section';
import { projects } from '@raineworks/web-marketing/content/profile';
import { Box, Text } from 'ink';

export function Projects() {
	return (
		<Box flexDirection="column">
			{projects.map((project) => (
				<Block key={project.name}>
					<Heading>{project.name}</Heading>
					<Text>{sanitize(project.description)}</Text>
					<Dim>{project.stack.join(' · ')}</Dim>
					{project.href && <Dim>{project.href}</Dim>}
				</Block>
			))}
		</Box>
	);
}
