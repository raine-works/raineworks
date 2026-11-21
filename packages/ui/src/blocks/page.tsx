/**
 * A page: its `h1` under a short rule in the accent gradient (with an icon beside it, if given), a description under it, and its blocks `gap-6` apart. Sets `document.title` to
 * "<title> · raineworks", or just the name when `title` isn't plain text.
 *
 * @module blocks/page
 */

import { documentTitle } from '@raineworks/ui/lib/head';
import { cn } from '@raineworks/ui/lib/utils';
import { type ReactNode, useEffect } from 'react';

/** Sets the tab's title while the page is shown. */
export function useDocumentTitle(title?: string) {
	useEffect(() => {
		document.title = documentTitle(title);
	}, [title]);
}

export function Page({
	title,
	icon,
	description,
	className,
	children,
}: {
	title: ReactNode;
	/** Beside the title: a project's logo. */
	icon?: ReactNode;
	description?: ReactNode;
	className?: string;
	children?: ReactNode;
}) {
	useDocumentTitle(typeof title === 'string' ? title : undefined);
	return (
		<div className={cn('flex flex-col gap-6', className)}>
			<header className="flex flex-col gap-2">
				<span aria-hidden="true" className="mb-1.5 h-0.5 w-10 rounded-full gradient-fill" />
				{icon ? (
					<div className="flex items-center gap-4">
						{icon}
						<h1 className="min-w-0 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
					</div>
				) : (
					<h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
				)}
				{description && <p className="text-pretty text-muted-foreground md:text-lg">{description}</p>}
			</header>
			{children}
		</div>
	);
}
