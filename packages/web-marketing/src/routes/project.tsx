/**
 * A project's page, `/projects/<slug>`: what it is in detail (`content/project-pages`), its highlights, getting started
 * and how it works, beside what GitHub says about it now (its stars and what it's built with, live from
 * `GET /api/projects`, never prerendered), and on to the next project. Only projects in `content/projects` have one;
 * the router sends any other slug to the 404.
 *
 * @module routes/project
 */

import { isDocsProject } from '@raineworks/tools/docs';
import { Page } from '@raineworks/ui/blocks/page';
import { Badge } from '@raineworks/ui/components/badge';
import { Button } from '@raineworks/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { Skeleton } from '@raineworks/ui/components/skeleton';
import { GitHubIcon, HomeAssistantIcon } from '@raineworks/web-marketing/components/brand-icons';
import { projectsQuery, StarCount } from '@raineworks/web-marketing/components/project-card';
import { profile } from '@raineworks/web-marketing/content/profile';
import { projectPages, type ProjectSection } from '@raineworks/web-marketing/content/project-pages';
import { marketplaceUrl, type ProjectEntry, projects, repoFileUrl } from '@raineworks/web-marketing/content/projects';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, BookOpenIcon } from 'lucide-react';

const route = getRouteApi('/projects/$slug');

/** Whose repositories: the GitHub profile's last segment. */
const GITHUB_OWNER = new URL(profile.contact.github).pathname.slice(1);

/** A heading for one of the page's parts, the same size throughout. */
function SectionTitle({ id, children }: { id: string; children: string }) {
	return (
		<h2 id={id} className="text-xl font-semibold tracking-tight">
			{children}
		</h2>
	);
}

/** One of the page's sections: its paragraphs, then its points, each marked with a dot of the accent. */
function Section({ section, index }: { section: ProjectSection; index: number }) {
	const id = `section-${index}`;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-3">
			<SectionTitle id={id}>{section.heading}</SectionTitle>
			{section.body.map((paragraph) => (
				<p key={paragraph} className="leading-relaxed text-pretty text-muted-foreground">
					{paragraph}
				</p>
			))}
			{section.points && (
				<ul className="flex flex-col gap-2.5 pt-1">
					{section.points.map((point) => (
						<li key={point} className="flex gap-3 leading-relaxed text-pretty">
							<span aria-hidden="true" className="mt-[0.6rem] size-1.5 shrink-0 rounded-full gradient-fill" />
							<span className="min-w-0">{point}</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/** What GitHub says about it now: the repository, its stars and what it's built with. Live, so placeholders first. */
function AtAGlance({ project }: { project: ProjectEntry }) {
	const { data } = useQuery(projectsQuery());
	const live = data?.find((entry) => entry.name === project.repo);
	const href = live?.href ?? `${profile.contact.github}/${project.repo}`;
	return (
		<Card className="gap-4 lg:sticky lg:top-24">
			<CardHeader className="flex items-center justify-between gap-3">
				<CardTitle className="text-sm font-medium text-muted-foreground">On GitHub</CardTitle>
				{live ? <StarCount count={live.stars} /> : <Skeleton className="h-5 w-12" />}
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex min-w-0 items-center gap-2 item-link font-mono text-sm"
				>
					<GitHubIcon className="size-4 shrink-0 text-muted-foreground" />
					<span className="truncate">
						{GITHUB_OWNER}/{project.repo}
					</span>
					<ArrowUpRightIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
				</a>
				<div className="flex flex-col gap-2">
					<p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Built with</p>
					{live ? (
						<ul className="flex flex-wrap gap-1.5" aria-label="Built with">
							{live.stack.map((tech) => (
								<li key={tech}>
									<Badge variant="outline" className="font-mono text-[11px] font-normal text-muted-foreground">
										{tech}
									</Badge>
								</li>
							))}
						</ul>
					) : (
						<div className="flex flex-wrap gap-1.5" aria-hidden="true">
							<Skeleton className="h-5 w-14" />
							<Skeleton className="h-5 w-20" />
							<Skeleton className="h-5 w-16" />
						</div>
					)}
				</div>
				{project.homeAssistant && (
					<Button asChild variant="outline" className="w-full">
						<a href={marketplaceUrl(project)} target="_blank" rel="noopener noreferrer">
							<HomeAssistantIcon />
							Add to Home Assistant
						</a>
					</Button>
				)}
				{isDocsProject(project.slug) && (
					<Button asChild variant="outline" className="w-full">
						<Link to="/projects/$slug/docs" params={{ slug: project.slug }}>
							<BookOpenIcon />
							Read the documentation
						</Link>
					</Button>
				)}
				<Button asChild className="w-full">
					<a href={href} target="_blank" rel="noopener noreferrer">
						<GitHubIcon />
						View the source
					</a>
				</Button>
				{project.disclaimer && (
					<p className="border-t pt-4 text-xs leading-relaxed text-pretty text-muted-foreground">
						{project.disclaimer}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

/** Screenshots from the repository: the first wide, the rest in a grid; each opens full size. */
function Screenshots({ project }: { project: ProjectEntry }) {
	if (!project.screenshots?.length) return null;
	return (
		<section aria-labelledby="screenshots" className="flex flex-col gap-4">
			<SectionTitle id="screenshots">Screenshots</SectionTitle>
			<ul className="grid gap-3 sm:grid-cols-2">
				{project.screenshots.map((shot, index) => (
					<li key={shot.path} className={index === 0 ? 'sm:col-span-2' : undefined}>
						<a
							href={repoFileUrl(project, shot.path)}
							target="_blank"
							rel="noopener noreferrer"
							className="block overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] outline-none hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
						>
							<img
								src={repoFileUrl(project, shot.path)}
								alt={shot.alt}
								loading="lazy"
								decoding="async"
								className="h-auto w-full"
							/>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

/** The project's logo from its repository, beside the title. */
function ProjectLogo({ project }: { project: ProjectEntry }) {
	if (!project.logo) return null;
	return (
		<img
			src={repoFileUrl(project, project.logo)}
			alt=""
			width={56}
			height={56}
			className="size-12 shrink-0 rounded-xl md:size-14"
		/>
	);
}

/** The next project, round to the first: the page goes on rather than ending. */
function NextProject({ project }: { project: ProjectEntry }) {
	const index = projects.findIndex((entry) => entry.slug === project.slug);
	const next = projects[(index + 1) % projects.length];
	if (!next || next.slug === project.slug) return null;
	return (
		<nav aria-label="More projects" className="flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center">
			<Link
				to="/projects"
				className="inline-flex items-center gap-1.5 item-link text-sm font-medium text-muted-foreground"
			>
				<ArrowLeftIcon className="size-4" />
				All projects
			</Link>
			<Link
				to="/projects/$slug"
				params={{ slug: next.slug }}
				className="group flex min-w-0 flex-col gap-1 rounded-xl border bg-card px-5 py-4 transition-[border-color,box-shadow] outline-none hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring sm:ml-auto sm:max-w-sm sm:text-right"
			>
				<span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Next project</span>
				<span className="inline-flex items-center gap-1.5 font-medium sm:justify-end">
					<span className="truncate">{next.title}</span>
					<ArrowRightIcon
						aria-hidden="true"
						className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
					/>
				</span>
			</Link>
		</nav>
	);
}

export function ProjectPage() {
	const { project } = route.useLoaderData();
	const page = projectPages[project.slug];
	return (
		<div className="flex flex-col gap-10 md:gap-14">
			<Link
				to="/projects"
				className="-mb-5 inline-flex items-center gap-1.5 self-start item-link text-sm font-medium text-muted-foreground md:-mb-9"
			>
				<ArrowLeftIcon className="size-4" />
				Projects
			</Link>
			<Page
				title={project.title}
				icon={<ProjectLogo project={project} />}
				description={project.summary}
				className="[&>header]:max-w-3xl"
			>
				<div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
					<div className="flex min-w-0 flex-col gap-10 md:gap-12">
						{page && (
							<>
								<section aria-label="Overview" className="flex max-w-2xl flex-col gap-4">
									{page.overview.map((paragraph, index) => (
										<p
											key={paragraph}
											className={
												index === 0
													? 'text-lg leading-relaxed text-pretty'
													: 'leading-relaxed text-pretty text-muted-foreground'
											}
										>
											{paragraph}
										</p>
									))}
								</section>

								<section aria-labelledby="highlights" className="flex flex-col gap-4">
									<SectionTitle id="highlights">Highlights</SectionTitle>
									<ul className="grid gap-3 sm:grid-cols-2">
										{page.highlights.map((highlight) => (
											<li
												key={highlight.title}
												className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-4 sm:px-5"
											>
												<h3 className="flex items-center gap-2.5 font-medium">
													<span
														aria-hidden="true"
														className="h-3.5 w-0.5 shrink-0 rounded-full bg-linear-to-b/oklab from-gradient-from to-gradient-to"
													/>
													{highlight.title}
												</h3>
												<p className="text-sm leading-relaxed text-pretty text-muted-foreground">{highlight.text}</p>
											</li>
										))}
									</ul>
								</section>

								<Screenshots project={project} />

								<div className="flex max-w-2xl flex-col gap-10 md:gap-12">
									{page.sections.map((section, index) => (
										<Section key={section.heading} section={section} index={index} />
									))}
								</div>
							</>
						)}
					</div>
					<aside aria-label="On GitHub">
						<AtAGlance project={project} />
					</aside>
				</div>
			</Page>
			<NextProject project={project} />
		</div>
	);
}
