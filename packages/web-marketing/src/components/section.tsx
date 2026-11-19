/**
 * A card with a heading (`h2`) and a description over its content: a part of a page that isn't a list.
 *
 * @module components/section
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import type { ReactNode } from 'react';

export function Section({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{title}</h2>
				</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
