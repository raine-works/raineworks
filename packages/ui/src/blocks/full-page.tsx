/**
 * Whole-page states inside a zone's layout: `NotFoundPage`, every router's `notFoundComponent`.
 *
 * @module blocks/full-page
 */

import { useDocumentTitle } from '@raineworks/ui/blocks/page';
import { Button } from '@raineworks/ui/components/button';
import { Link } from '@tanstack/react-router';

/** A path no route matches: says so, and leads home. */
export function NotFoundPage() {
	useDocumentTitle('Page not found');
	return (
		<div className="flex flex-col items-start gap-4 py-16">
			<p className="font-mono text-sm text-muted-foreground">404</p>
			<h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
			<p className="text-muted-foreground">That address doesn’t lead anywhere on this site.</p>
			<Button asChild>
				<Link to="/">Back home</Link>
			</Button>
		</div>
	);
}
