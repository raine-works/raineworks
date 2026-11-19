/**
 * Projects as cards: each one's name (the whole card opens the repository), what it is, what it's built with, and its
 * stars on GitHub. The list is live (`GET /api/projects`: the repositories tagged `raineworks`), fetched by the browser,
 * never prerendered, so never stale: the prerendered page has placeholder cards the same size, so nothing jumps when
 * the projects arrive. When they can't load, a card says so and links to GitHub instead.
 *
 * @module components/project-card
 */

import type { Project } from '@raineworks/api';
import { Badge } from '@raineworks/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { Skeleton } from '@raineworks/ui/components/skeleton';
import { api, unwrap } from '@raineworks/ui/lib/api';
import { SOURCE_URL } from '@raineworks/ui/lib/brand';
import { cn } from '@raineworks/ui/lib/utils';
import { GitHubIcon } from '@raineworks/web-marketing/components/brand-icons';
import { profile } from '@raineworks/web-marketing/content/profile';
import '@raineworks/tools/prototypes';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { ArrowUpRightIcon, StarIcon } from 'lucide-react';

/** Every project, asked once for all the cards on a page; the server keeps them ten minutes. */
const projectsQuery = () =>
	queryOptions({
		queryKey: ['projects'],
		queryFn: async () => {
			const body = await unwrap(api.api.projects.$get());
			// `unwrap` threw for the 503: what's left is the list.
			return 'projects' in body ? body.projects : [];
		},
		staleTime: 10 * 60_000,
		retry: false,
	});

const compactCount = new Intl.NumberFormat('en', { notation: 'compact' });

/** A repository's stars, in a slot as wide as any count it shows. */
function StarCount({ count }: { count: number }) {
	return (
		<span className="inline-flex h-5 w-12 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground tabular-nums">
			<StarIcon aria-hidden="true" className="size-3.5" />
			{compactCount.format(count)}
			<span className="sr-only">{count === 1 ? ' star' : ' stars'} on GitHub</span>
		</span>
	);
}

/** A project: its name (linking to the repo, the whole card clickable), what it is, and what it's built with. */
export function ProjectCard({ project }: { project: Project }) {
	const here = project.href === SOURCE_URL;
	return (
		<Card className="group relative h-full gap-5 transition-[border-color,box-shadow,translate] duration-200 has-[a:hover]:-translate-y-0.5 has-[a:hover]:border-foreground/20 has-[a:hover]:shadow-md motion-reduce:transition-none">
			<CardHeader className="gap-2">
				<CardTitle className="flex items-center gap-2 font-mono text-base">
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
					{here && (
						<span className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-sans text-xs font-normal text-muted-foreground">
							<span className="size-2 rounded-full bg-success" aria-hidden="true" />
							You’re here
						</span>
					)}
					<ArrowUpRightIcon
						className={cn(
							'size-4 shrink-0 text-muted-foreground transition-transform group-has-[a:hover]:translate-x-0.5 group-has-[a:hover]:-translate-y-0.5 group-has-[a:hover]:text-foreground',
							!here && 'ml-auto',
						)}
					/>
				</CardTitle>
				{project.description && <CardDescription className="leading-relaxed">{project.description}</CardDescription>}
			</CardHeader>
			<CardContent className="mt-auto flex items-end gap-3">
				<ul className="flex flex-1 flex-wrap gap-1.5" aria-label="Built with">
					{project.stack.map((tech) => (
						<li key={tech}>
							<Badge variant="outline" className="font-mono text-[11px] font-normal text-muted-foreground">
								{tech}
							</Badge>
						</li>
					))}
				</ul>
				<StarCount count={project.stars} />
			</CardContent>
		</Card>
	);
}

/** A card's shape while the projects load. */
function ProjectCardPlaceholder() {
	return (
		<Card className="h-full gap-5" aria-hidden="true">
			<CardHeader className="gap-3">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</CardHeader>
			<CardContent className="mt-auto flex gap-1.5">
				<Skeleton className="h-5 w-14" />
				<Skeleton className="h-5 w-20" />
				<Skeleton className="h-5 w-16" />
			</CardContent>
		</Card>
	);
}

/** In place of the cards when there are none to show: why, and GitHub instead. */
function ProjectsUnavailable({ message }: { message: string }) {
	return (
		<Card className="col-span-full">
			<CardHeader>
				<CardDescription>
					{message}{' '}
					<a href={profile.contact.github} target="_blank" rel="noopener noreferrer" className="item-link">
						See them on GitHub
					</a>
					.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

/** Every project as a card, or only the featured ones; `placeholders` cards' worth of shapes while they load. */
export function ProjectCards({ featured = false, placeholders }: { featured?: boolean; placeholders: number }) {
	const { data, isPending, isError } = useQuery(projectsQuery());
	if (isPending) return Array.from({ length: placeholders }, (_, i) => <ProjectCardPlaceholder key={i} />);
	if (isError) return <ProjectsUnavailable message="The projects couldn’t be loaded from GitHub just now." />;
	const shown = featured ? data.filter((project) => project.featured) : data;
	if (shown.isEmpty()) return <ProjectsUnavailable message="There are no projects to show here yet." />;
	return shown.map((project) => <ProjectCard key={project.name} project={project} />);
}
