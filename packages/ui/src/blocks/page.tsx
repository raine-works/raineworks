/**
 * A page: its `h1`, a description under it, and its blocks `gap-6` apart. Sets `document.title` to
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
	description,
	className,
	children,
}: {
	title: ReactNode;
	description?: ReactNode;
	className?: string;
	children?: ReactNode;
}) {
	useDocumentTitle(typeof title === 'string' ? title : undefined);
	return (
		<div className={cn('flex flex-col gap-6', className)}>
			<header className="flex flex-col gap-1.5">
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{description && <p className="text-muted-foreground">{description}</p>}
			</header>
			{children}
		</div>
	);
}
