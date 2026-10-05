import { projects } from '@marketing/content/profile';
import { Box, Text } from 'ink';
import { sanitize } from '@/sanitize';
import { Block, Dim, Heading } from '@/screens/Section';

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
