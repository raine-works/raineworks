/**
 * A project as a card: its name (the whole card opens the repository), what it is, and what it's built with.
 *
 * @module components/project-card
 */

import { Badge } from '@raineworks/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { GitHubIcon } from '@raineworks/web-marketing/components/brand-icons';
import type { ProjectEntry } from '@raineworks/web-marketing/content/profile';
import { ArrowUpRightIcon } from 'lucide-react';

/** A project: its name (linking to the repo, the whole card clickable), what it is, and what it's built with. */
export function ProjectCard({ project }: { project: ProjectEntry }) {
	return (
		<Card className="group relative h-full gap-5 transition-[border-color,box-shadow,translate] duration-200 has-[a:hover]:-translate-y-0.5 has-[a:hover]:border-foreground/20 has-[a:hover]:shadow-md motion-reduce:transition-none">
			<CardHeader className="gap-2">
				<CardTitle className="flex items-center gap-2 font-mono text-base">
					{project.href ? (
						<>
							<GitHubIcon className="size-4 shrink-0 text-muted-foreground" />
							{/* The link's box covers the card, so the whole card opens the repo. */}
							<a
								href={project.href}
								target="_blank"
								rel="noopener noreferrer"
								className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
							>
								{project.name}
							</a>
							<ArrowUpRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-has-[a:hover]:translate-x-0.5 group-has-[a:hover]:-translate-y-0.5 group-has-[a:hover]:text-foreground" />
						</>
					) : (
						<>
							<span className="size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
							{project.name}
							<span className="ml-auto font-sans text-xs font-normal text-muted-foreground">You’re here</span>
						</>
					)}
				</CardTitle>
				<CardDescription className="leading-relaxed">{project.description}</CardDescription>
			</CardHeader>
			<CardContent className="mt-auto">
				<ul className="flex flex-wrap gap-1.5" aria-label="Built with">
					{project.stack.map((tech) => (
						<li key={tech}>
							<Badge variant="outline" className="font-mono text-[11px] font-normal text-muted-foreground">
								{tech}
							</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
