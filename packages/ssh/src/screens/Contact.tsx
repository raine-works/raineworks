import { profile } from '@marketing/content/profile';
import { Box, Text } from 'ink';
import { Dim, Heading } from '@/screens/Section';

export function Contact() {
	const { email, github, linkedin } = profile.contact;
	return (
		<Box flexDirection="column" gap={1}>
			<Heading>say hello</Heading>
			<Box flexDirection="column">
				<Text>{`email     ${email}`}</Text>
				<Text>{`github    ${github}`}</Text>
				<Text>{`linkedin  ${linkedin}`}</Text>
			</Box>
			<Dim>The contact form lives on the web: https://raineworks.com/contact</Dim>
		</Box>
	);
}
