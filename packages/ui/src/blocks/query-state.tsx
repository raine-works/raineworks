/**
 * Every state a query's part of the page can be in, the same way everywhere:
 *
 * - loading: one skeleton per kind of content (`list` rows, a `detail` page,
 *   an `inline` line), announced to screen readers;
 * - failed: an alert with the server's message (`errorMessage`) and Retry;
 *   a 404 shows `notFound` instead, when given (a detail page); a piece of
 *   the app that's gone after a release (`isChunkLoadError`) says so and
 *   offers Reload;
 * - empty (`isEmpty`): `empty`, usually an `EmptyState`;
 * - loaded: `children(data)`.
 *
 * Data already on screen stays there when a refetch fails. A part that needs several queries passes `allOf([…])`.
 *
 * ```tsx
 * <QueryState query={widgets} loading="list" isEmpty={(data) => data.widgets.isEmpty()}
 *   empty={<EmptyState title="No widgets yet" />}>
 *   {(data) => <WidgetsTable widgets={data.widgets} />}
 * </QueryState>
 * ```
 *
 * @module blocks/query-state
 */

import { Alert, AlertDescription, AlertTitle } from '@raineworks/ui/components/alert';
import { Button } from '@raineworks/ui/components/button';
import { Skeleton } from '@raineworks/ui/components/skeleton';
import { Spinner } from '@raineworks/ui/components/spinner';
import { ApiError, errorMessage } from '@raineworks/ui/lib/api';
import { isChunkLoadError } from '@raineworks/ui/lib/lazy';
import { cn } from '@raineworks/ui/lib/utils';
import { AlertCircleIcon, RefreshCwIcon, RotateCwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import '@raineworks/tools/prototypes';

/** Which skeleton a loading part shows: rows, a detail page, or a line. */
export type LoadingKind = 'list' | 'detail' | 'inline';

/** What `QueryState` reads of a TanStack Query result. */
export interface QueryLike<T> {
	data: T | undefined;
	error: unknown;
	isFetching: boolean;
	refetch: () => unknown;
}

/**
 * Several queries as one, for a part of the page that needs them all (a row of counts): loaded once every one is, failed
 * while any has failed and isn't loaded, and Retry refetches those that failed.
 *
 * ```tsx
 * <QueryState query={allOf([widgets, lists])} loading="inline">{([w, l]) => …}</QueryState>
 * ```
 */
export function allOf<const T extends readonly unknown[]>(queries: {
	[K in keyof T]: QueryLike<T[K]>;
}): QueryLike<T> {
	const list = queries as readonly QueryLike<unknown>[];
	const loaded = list.every((query) => query.data !== undefined);
	return {
		data: loaded ? (list.map((query) => query.data) as unknown as T) : undefined,
		error: list.find((query) => query.data === undefined && query.error)?.error ?? null,
		isFetching: list.some((query) => query.isFetching),
		refetch: () => Promise.all(list.filter((query) => query.error).map((query) => query.refetch())),
	};
}

/** The skeleton for a kind of content, for loading states with no single query. */
export function LoadingState({ kind = 'list', className }: { kind?: LoadingKind; className?: string }) {
	return (
		<div role="status" aria-live="polite" className={cn('grid gap-3', className)}>
			<span className="sr-only">Loading…</span>
			{kind === 'inline' ? (
				<Skeleton className="h-5 w-48" />
			) : kind === 'list' ? (
				<>
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-3/4" />
				</>
			) : (
				// A page's sections; its title row is `Page`'s own placeholder.
				<div className="grid gap-4">
					<Skeleton className="h-32 w-full rounded-xl" />
					<Skeleton className="h-64 w-full rounded-xl" />
				</div>
			)}
		</div>
	);
}

/**
 * A failure: the server's message (`errorMessage`) and a way to try again. A piece of the app that failed to load
 * (`isChunkLoadError`: most likely replaced by a release) says the app was updated and offers Reload, the one thing
 * that fixes it.
 */
export function ErrorState({
	error,
	onRetry,
	retrying = false,
	title = 'Couldn’t load this',
	className,
}: {
	error: unknown;
	onRetry?: () => unknown;
	retrying?: boolean;
	title?: string;
	className?: string;
}) {
	const stale = isChunkLoadError(error);
	return (
		<Alert variant="destructive" className={className}>
			<AlertCircleIcon />
			<AlertTitle>{stale ? 'The app has been updated' : title}</AlertTitle>
			<AlertDescription>
				<p>
					{stale ? 'Part of this page is from the version before. Reload to use the new one.' : errorMessage(error)}
				</p>
				{/* A missing chunk stays missing however often it's retried: only a reload gets the new one. */}
				{stale ? (
					<Button variant="outline" size="sm" className="mt-1" onClick={() => location.reload()}>
						<RefreshCwIcon />
						Reload
					</Button>
				) : (
					onRetry && (
						<Button variant="outline" size="sm" className="mt-1" disabled={retrying} onClick={() => void onRetry()}>
							{retrying ? <Spinner /> : <RotateCwIcon />}
							Retry
						</Button>
					)
				)}
			</AlertDescription>
		</Alert>
	);
}

/** Renders `query`'s part of the page in whichever state it's in; `children` only ever gets loaded data. */
export function QueryState<T>({
	query,
	loading = 'list',
	notFound,
	isEmpty,
	empty,
	className,
	children,
}: {
	query: QueryLike<T>;
	loading?: LoadingKind;
	/** Shown for a 404 (it doesn't exist, or isn't the viewer's). Without it, a 404 is an error like any other. */
	notFound?: ReactNode;
	isEmpty?: (data: T) => boolean;
	empty?: ReactNode;
	className?: string;
	children: (data: T) => ReactNode;
}) {
	if (query.data !== undefined) {
		if (isEmpty?.(query.data) && empty !== undefined) return empty;
		return children(query.data);
	}
	if (query.error) {
		if (notFound !== undefined && query.error instanceof ApiError && query.error.status === 404) return notFound;
		return <ErrorState error={query.error} onRetry={query.refetch} retrying={query.isFetching} className={className} />;
	}
	return <LoadingState kind={loading} className={className} />;
}
