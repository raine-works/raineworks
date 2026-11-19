/**
 * Projects: the list on the left (↑/↓ or j/k, or click), the one chosen in full on the right: what it is, what it's
 * built with, its stars, and its repository as a link. Stacked on a narrow terminal. The projects are the site's
 * (`GET /api/projects`, the repositories tagged `raineworks` on GitHub): until they're in, or if they can't be had, it
 * says so.
 *
 * @module screens/projects
 */

import type { Project } from '@raineworks/api';
import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Card, Chips, Heading } from '@raineworks/ssh/ui/panel';
import { profile } from '@raineworks/web-marketing/content/profile';
import '@raineworks/tools/prototypes';

export function Projects({
	projects,
	index,
	onPick,
	width,
}: {
	/** `undefined` while they load, `null` when they couldn't. */
	projects: Project[] | null | undefined;
	index: number;
	onPick: (index: number) => void;
	width: number;
}) {
	if (!projects || projects.isEmpty())
		return (
			<box style={{ flexDirection: 'column', padding: 1, paddingLeft: 2 }}>
				<Heading eyebrow="open source" title="Projects" />
				<text fg={theme.muted}>
					{projects === undefined
						? 'Loading the projects from GitHub…'
						: projects === null
							? 'The projects couldn’t be loaded from GitHub just now.'
							: 'There are no projects to show here yet.'}
				</text>
				{projects !== undefined && (
					<text>
						<span fg={theme.dim}>{'see them at  '}</span>
						<a href={profile.contact.github} fg={theme.accent}>
							{profile.contact.github.replace('https://', '')}
						</a>
					</text>
				)}
			</box>
		);
	const project = projects[index] ?? projects[0];
	const wide = width >= 80;
	return (
		<box style={{ flexDirection: 'column', padding: 1, paddingLeft: 2 }}>
			<Heading eyebrow="open source" title="Projects" />
			<box style={{ flexDirection: wide ? 'row' : 'column', gap: 2 }}>
				<box style={{ flexDirection: 'column', width: wide ? 28 : undefined }}>
					{projects.map((each, i) => {
						const active = i === index;
						return (
							<box
								key={each.name}
								onMouseDown={() => onPick(i)}
								style={{ height: 1, backgroundColor: active ? theme.raised : undefined }}
							>
								<text>
									<span fg={active ? theme.accent : theme.bg}>▌</span>
									<span fg={each.featured ? theme.accent : theme.faint}>{each.featured ? ' ★ ' : ' · '}</span>
									<span fg={active ? theme.text : theme.muted}>{sanitize(each.name)}</span>
								</text>
							</box>
						);
					})}
					<text fg={theme.faint}>{`\n${index + 1} of ${projects.length} · ↑/↓`}</text>
				</box>
				{project && (
					<Card title={project.featured ? 'featured' : 'project'} accent={project.featured} grow>
						<box style={{ height: 1 }} />
						<text>
							<strong fg={theme.text}>{sanitize(project.name)}</strong>
						</text>
						{project.description && (
							<>
								<box style={{ height: 1 }} />
								<text fg={theme.muted} wrapMode="word">
									{sanitize(project.description)}
								</text>
							</>
						)}
						{!project.stack.isEmpty() && (
							<>
								<box style={{ height: 1 }} />
								<text fg={theme.dim}>built with</text>
								<Chips items={project.stack.map(sanitize)} />
							</>
						)}
						<box style={{ height: 1 }} />
						<text>
							<span fg={theme.dim}>{'stars '}</span>
							<span fg={theme.text}>{String(project.stars)}</span>
						</text>
						<text>
							<span fg={theme.dim}>{'repo  '}</span>
							<a href={sanitize(project.href)} fg={theme.accent}>
								{sanitize(project.href.replace('https://', ''))}
							</a>
						</text>
						{project.name === 'raineworks' && (
							<text fg={theme.success}>● you’re looking at it (in a terminal, this time)</text>
						)}
						<box style={{ height: 1 }} />
					</Card>
				)}
			</box>
		</box>
	);
}
