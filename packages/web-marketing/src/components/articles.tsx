/**
 * Raine's articles on X (`GET /api/articles`), fetched by the browser, never prerendered: whether they're on (the
 * server has an X API token) and the list, newest first, each linking to it on x.com.
 *
 * @module components/articles
 */

import { Card, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { Skeleton } from '@raineworks/ui/components/skeleton';
import { api, unwrap } from '@raineworks/ui/lib/api';
import { profile } from '@raineworks/web-marketing/content/profile';
import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { ArrowUpRightIcon } from 'lucide-react';
import '@raineworks/tools/prototypes';

/** The articles, or that they're off; the server keeps them an hour. */
export const articlesQuery = () =>
	queryOptions({
		queryKey: ['articles'],
		queryFn: async () => {
			const body = await unwrap(api.api.articles.$get());
			// `unwrap` threw for the 503: what's left is the answer.
			return 'enabled' in body ? body : { enabled: false as const };
		},
		staleTime: 60 * 60_000,
		retry: false,
	});

/**
 * Whether they're on, apart from the list: the `/articles` route asks before it renders, and filling
 * {@link articlesQuery} then would render the list over the prerendered placeholders it hydrates.
 */
const articlesOnQuery = () =>
	queryOptions({
		queryKey: ['articles', 'on'],
		queryFn: async () => {
			const body = await unwrap(api.api.articles.$get());
			// `unwrap` threw for the 503: what's left is the answer.
			return 'enabled' in body && body.enabled;
		},
		staleTime: 60 * 60_000,
		retry: false,
	});

/**
 * The `/articles` route's check in the browser: when the server says they're off, it's the 404 (what the server sent
 * for the page, so it hydrates as one, and the same on a visit from another page). When the server can't say, the
 * page shows that instead.
 */
export async function ensureArticlesOn(queryClient: QueryClient): Promise<void> {
	const { data: on } = await queryClient.fetchQuery(articlesOnQuery()).tryCatch();
	if (on === false) throw notFound();
}

const published = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

/** A card's shape while the articles load. */
function ArticlePlaceholder() {
	return (
		<Card aria-hidden="true">
			<CardHeader className="gap-3">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-5 w-3/4" />
				<Skeleton className="h-4 w-full" />
			</CardHeader>
		</Card>
	);
}

/** In place of the list: why, and X instead. */
function ArticlesMessage({ message }: { message: string }) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>
					{message}{' '}
					<a href={profile.contact.x} target="_blank" rel="noopener noreferrer" className="item-link">
						See @raineworks on X
					</a>
					.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

/** Every article as a card opening it on X; placeholders while they load. */
export function ArticleList() {
	const { data, isPending, isError } = useQuery(articlesQuery());
	if (isPending) return Array.from({ length: 3 }, (_, i) => <ArticlePlaceholder key={i} />);
	if (isError) return <ArticlesMessage message="The articles couldn’t be loaded from X just now." />;
	if (!data.enabled) return <ArticlesMessage message="There are no articles here." />;
	if (data.articles.isEmpty()) return <ArticlesMessage message="No articles yet." />;
	return data.articles.map((article) => (
		<Card
			key={article.id}
			className="group relative transition-[border-color,box-shadow,translate] duration-200 has-[a:hover]:-translate-y-0.5 has-[a:hover]:border-foreground/20 has-[a:hover]:shadow-md motion-reduce:transition-none"
		>
			<CardHeader className="gap-2">
				<time dateTime={article.publishedAt} className="text-xs text-muted-foreground">
					{published.format(new Date(article.publishedAt))}
				</time>
				<CardTitle className="flex items-start gap-2 text-lg leading-snug">
					{/* The link's box covers the card, so the whole card opens the article. */}
					<a
						href={article.url}
						target="_blank"
						rel="noopener noreferrer"
						className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
					>
						{article.title}
						<span className="sr-only"> (on X, opens in a new tab)</span>
					</a>
					<ArrowUpRightIcon
						aria-hidden="true"
						className="mt-1 ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-has-[a:hover]:translate-x-0.5 group-has-[a:hover]:-translate-y-0.5 group-has-[a:hover]:text-foreground"
					/>
				</CardTitle>
				{article.summary && <CardDescription className="leading-relaxed">{article.summary}</CardDescription>}
			</CardHeader>
		</Card>
	));
}
