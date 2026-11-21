/**
 * A home-page section's heading: a small label over an `h2`, with an optional "see all" link beside it.
 *
 * @module components/section-heading
 */

import { Link } from '@tanstack/react-router';
import { ArrowRightIcon } from 'lucide-react';

/** A home-page section's heading: a small label over an `h2`, with an optional "see all" link beside it. */
export function SectionHeading({
	eyebrow,
	title,
	more,
}: {
	eyebrow: string;
	title: string;
	more?: { to: '/work' | '/projects'; label: string };
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div className="flex flex-col gap-1">
				<p className="self-start font-mono text-xs tracking-widest uppercase">
					<span className="text-gradient">{eyebrow}</span>
				</p>
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
			</div>
			{more && (
				<Link
					to={more.to}
					className="inline-flex items-center gap-1 item-link text-sm font-medium text-muted-foreground"
				>
					{more.label}
					<ArrowRightIcon className="size-4" />
				</Link>
			)}
		</div>
	);
}
