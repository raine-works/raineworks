/**
 * A project's documentation, `/projects/<slug>/docs` (its index) and `/projects/<slug>/docs/<page>`: the Markdown in the
 * project's repository, rendered by the server (`GET /api/docs/<project>`, `lib/docs`) and shown here with the
 * navigation its index gives, "On this page" and a link to the file on GitHub. Fetched in the browser, never
 * prerendered: every docs page is the project's prerendered docs page until its content arrives (the server hands it
 * out for any page under it), so what's rendered first is the same whichever page was asked for.
 *
 * @module routes/project-docs
 */

import type { DocsPage } from '@raineworks/api';
import { docsPath, type DocsProject, docsRepoUrl, isDocsPage, isDocsProject } from '@raineworks/tools/docs';
import { Page, useDocumentTitle } from '@raineworks/ui/blocks/page';
import { QueryState } from '@raineworks/ui/blocks/query-state';
import { Button } from '@raineworks/ui/components/button';
import { Skeleton } from '@raineworks/ui/components/skeleton';
import { api, ApiError, unwrap } from '@raineworks/ui/lib/api';
import { cn } from '@raineworks/ui/lib/utils';
import { GitHubIcon } from '@raineworks/web-marketing/components/brand-icons';
import { projectBySlug } from '@raineworks/web-marketing/content/projects';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowUpRightIcon } from 'lucide-react';
import { type MouseEvent, useEffect } from 'react';
import '@raineworks/tools/prototypes';

/** A project's docs page from the server (`page` undefined: the index); the server keeps it five minutes. */
export const docsQuery = (slug: DocsProject, page: string | undefined) =>
	queryOptions({
		queryKey: ['docs', slug, page ?? ''],
		queryFn: async () => {
			const body = await unwrap(
				api.api.docs[':project'].$get({ param: { project: slug }, query: page ? { page } : {} }),
			);
			// `unwrap` threw for every refusal: what's left is the page.
			if (!('title' in body)) throw new Error('The documentation didn’t load.');
			return body;
		},
		staleTime: 5 * 60_000,
	});

type DocsData = DocsPage;

const NAV_LINK = 'block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-foreground';
const NAV_CURRENT = 'bg-accent font-medium text-foreground';

/** The pages the project's index lists, in groups, the current one marked. */
function DocsNav({ slug, page, nav }: { slug: DocsProject; page: string | undefined; nav: DocsData['nav'] }) {
	const groups = nav.map((item) => item.group).unique();
	const link = (current: boolean) => cn(NAV_LINK, current ? NAV_CURRENT : 'text-muted-foreground');
	return (
		<nav aria-label="Documentation pages" className="flex flex-col gap-4">
			<Link
				to="/projects/$slug/docs"
				params={{ slug }}
				aria-current={page === undefined ? 'page' : undefined}
				className={link(page === undefined)}
			>
				Overview
			</Link>
			{groups.map((group) => (
				<div key={group} className="flex flex-col gap-0.5">
					{group && (
						<p className="px-3 pb-1 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{group}</p>
					)}
					{nav
						.filter((item) => item.group === group)
						.map((item) => (
							<Link
								key={item.page}
								to="/projects/$slug/docs/$"
								params={(previous) => ({ ...previous, slug, _splat: item.page })}
								aria-current={item.page === page ? 'page' : undefined}
								className={link(item.page === page)}
							>
								{item.title}
							</Link>
						))}
				</div>
			))}
		</nav>
	);
}

/** The page's `##` and `###` headings, linking to them. */
function OnThisPage({ headings }: { headings: DocsData['headings'] }) {
	if (headings.isEmpty()) return null;
	return (
		<nav aria-label="On this page" className="flex flex-col gap-2">
			<p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">On this page</p>
			<ul className="flex flex-col gap-1.5 border-l pl-3 text-sm">
				{headings.map((heading) => (
					<li key={heading.id} className={cn('min-w-0', heading.level === 3 && 'pl-3')}>
						<a href={`#${heading.id}`} className="block truncate text-muted-foreground hover:text-foreground">
							{heading.text}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** The page: its rendered Markdown, with links to other docs pages followed within the app. */
function DocsBody({ slug, html }: { slug: DocsProject; html: string }) {
	const router = useRouter();
	// Links between docs pages are routes of the site: follow them without a page load. Anything else (a heading's
	// `#`, another site, a modified click) is the browser's.
	const follow = (event: MouseEvent<HTMLDivElement>) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		)
			return;
		const anchor = (event.target as Element).closest('a');
		const href = anchor?.getAttribute('href');
		if (!href || anchor?.target || !href.startsWith(docsPath(slug))) return;
		event.preventDefault();
		router.history.push(href);
	};
	return (
		// The server renders the page from Markdown that refuses raw HTML, and only links to the web, mail and this
		// site (`@raineworks/tools/markdown`, `lib/docs-render`): there's nothing in it to run.
		// biome-ignore lint/a11y/useKeyWithClickEvents: links inside are real links; this only upgrades their clicks.
		<div className="guide max-w-3xl" onClick={follow} dangerouslySetInnerHTML={{ __html: html }} />
	);
}

/** A loaded page: its title, then the navigation, the page and its contents. */
function DocsLoaded({ slug, page, data }: { slug: DocsProject; page: string | undefined; data: DocsData }) {
	const project = projectBySlug(slug);
	useDocumentTitle(project ? `${data.title} · ${project.title}` : data.title);
	// A new page starts at its top, or at the heading its link named.
	useEffect(() => {
		const id = decodeURIComponent(window.location.hash.slice(1));
		const target = id ? document.getElementById(id) : null;
		if (target) target.scrollIntoView();
		else window.scrollTo(0, 0);
	}, [data]);
	return (
		<div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_13rem]">
			<details className="rounded-xl border bg-card px-3 py-2 lg:hidden">
				<summary className="cursor-pointer py-1 text-sm font-medium">Pages</summary>
				<div className="pt-2 pb-1">
					<DocsNav slug={slug} page={page} nav={data.nav} />
				</div>
			</details>
			<aside className="hidden lg:sticky lg:top-24 lg:block">
				<DocsNav slug={slug} page={page} nav={data.nav} />
			</aside>
			<article className="min-w-0">
				<DocsBody slug={slug} html={data.html} />
			</article>
			<aside className="hidden xl:sticky xl:top-24 xl:block">
				<OnThisPage headings={data.headings} />
			</aside>
		</div>
	);
}

/** What a page that isn't in the docs says, with the way back. */
function DocsNotFound({ slug }: { slug: DocsProject }) {
	return (
		<div className="flex flex-col items-start gap-3">
			<p className="text-muted-foreground">There’s no page by that name in the documentation.</p>
			<Button asChild variant="outline">
				<Link to="/projects/$slug/docs" params={{ slug }}>
					Back to the documentation
				</Link>
			</Button>
		</div>
	);
}

/** The docs page for the address, the index or `<page>`, for either route. */
export function ProjectDocsPage() {
	const params = useParams({ strict: false }) as { slug: string; '*'?: string; _splat?: string };
	const slug = params.slug;
	const page = (params['*'] ?? params._splat)?.replace(/\/+$/, '') || undefined;
	const project = projectBySlug(slug);
	const valid = isDocsProject(slug) && (page === undefined || isDocsPage(page));
	const query = useQuery({ ...docsQuery(isDocsProject(slug) ? slug : 'ha-dashboards', page), enabled: valid });
	if (!project || !isDocsProject(slug)) return null;
	const missing = !valid || (query.error instanceof ApiError && query.error.status === 404);
	const source = page ? `${page}.md` : 'README.md';
	return (
		<div className="flex flex-col gap-10 md:gap-14">
			<nav aria-label="Breadcrumb" className="-mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 md:-mb-9">
				<Link
					to="/projects/$slug"
					params={{ slug }}
					className="inline-flex items-center gap-1.5 item-link text-sm font-medium text-muted-foreground"
				>
					<ArrowLeftIcon className="size-4" />
					{project.title}
				</Link>
				<a
					href={docsRepoUrl(slug, `docs/${source}`)}
					target="_blank"
					rel="noopener noreferrer"
					className="ml-auto inline-flex items-center gap-1.5 item-link text-sm text-muted-foreground"
				>
					<GitHubIcon className="size-4" />
					View source on GitHub
					<ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
				</a>
			</nav>
			<Page
				title={query.data?.title ?? (missing ? 'Page not found' : <Skeleton className="h-9 w-64 max-w-full" />)}
				description={query.data ? `${project.title} documentation` : undefined}
				className="[&>header]:max-w-3xl"
			>
				{valid ? (
					<QueryState query={query} loading="detail" notFound={<DocsNotFound slug={slug} />} className="max-w-3xl">
						{(data) => <DocsLoaded slug={slug} page={page} data={data} />}
					</QueryState>
				) : (
					<DocsNotFound slug={slug} />
				)}
			</Page>
		</div>
	);
}
