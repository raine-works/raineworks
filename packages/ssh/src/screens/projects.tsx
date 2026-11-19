/**
 * Projects: the list on the left (↑/↓ or j/k, or click), the one chosen in full on the right: what it is, what it's
 * built with, and its repository as a link. Stacked on a narrow terminal.
 *
 * @module screens/projects
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Card, Chips, Heading } from '@raineworks/ssh/ui/panel';
import { projects } from '@raineworks/web-marketing/content/profile';

export function Projects({ index, onPick, width }: { index: number; onPick: (index: number) => void; width: number }) {
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
						<box style={{ height: 1 }} />
						<text fg={theme.muted} wrapMode="word">
							{sanitize(project.description)}
						</text>
						<box style={{ height: 1 }} />
						<text fg={theme.dim}>built with</text>
						<Chips items={project.stack.map(sanitize)} />
						<box style={{ height: 1 }} />
						<text>
							<span fg={theme.dim}>{'repo  '}</span>
							<a href={project.href} fg={theme.accent}>
								{project.href.replace('https://', '')}
							</a>
						</text>
						{project.here && <text fg={theme.success}>● you’re looking at it (in a terminal, this time)</text>}
						<box style={{ height: 1 }} />
					</Card>
				)}
			</box>
		</box>
	);
}
