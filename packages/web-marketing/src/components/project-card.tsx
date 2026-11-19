/**
 * A project as a card: its name (the whole card opens the repository), its stars on GitHub, what it is, and what it's
 * built with. The stars are live (`GET /api/projects/stars`), shown once they're in: never prerendered, so never stale,
 * in a slot of their own so nothing moves when they arrive.
 *
 * @module components/project-card
 */

import { Badge } from '@raineworks/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { api, unwrap } from '@raineworks/ui/lib/api';
import { GitHubIcon } from '@raineworks/web-marketing/components/brand-icons';
import type { ProjectEntry } from '@raineworks/web-marketing/content/profile';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { ArrowUpRightIcon, StarIcon } from 'lucide-react';

/** Every repository's stars, asked once for all the cards on a page; the server keeps them ten minutes. */
const starsQuery = () =>
	queryOptions({
		queryKey: ['projects', 'stars'],
		queryFn: async () => {
			const body = await unwrap(api.api.projects.stars.$get());
			// `unwrap` threw for the 503: what's left is the counts.
			return 'stars' in body ? body.stars : {};
		},
		staleTime: 10 * 60_000,
		retry: false,
	});

const compactCount = new Intl.NumberFormat('en', { notation: 'compact' });

/** A repository's stars, in a slot as wide as any count it shows; empty until they're in, or if they can't be. */
function StarCount({ repo }: { repo: string }) {
	const count = useQuery(starsQuery()).data?.[repo];
	return (
		<span className="ml-auto inline-flex w-12 shrink-0 items-center justify-end gap-1 font-sans text-xs font-normal text-muted-foreground tabular-nums">
			{count !== undefined && (
				<>
					<StarIcon aria-hidden="true" className="size-3.5" />
					{compactCount.format(count)}
					<span className="sr-only">{count === 1 ? ' star' : ' stars'} on GitHub</span>
				</>
			)}
		</span>
	);
}

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
							<StarCount repo={project.name} />
							<ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform group-has-[a:hover]:translate-x-0.5 group-has-[a:hover]:-translate-y-0.5 group-has-[a:hover]:text-foreground" />
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
