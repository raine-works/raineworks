/**
 * The `/work` page: experience and education as timelines. Copy still to be written (`isWritten`) is left out.
 *
 * @module routes/work
 */

import { Page } from '@raineworks/ui/blocks/page';
import { Card, CardContent, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { education, isWritten, work } from '@raineworks/web-marketing/content/profile';
import type { ReactNode } from 'react';

/** A vertical timeline: a dot per entry on a line down the left. */
function Timeline({ children }: { children: ReactNode }) {
	return <ol className="relative flex flex-col gap-7 border-l pl-6">{children}</ol>;
}

function TimelineItem({
	title,
	meta,
	period,
	children,
}: {
	title: string;
	meta?: string;
	period: string;
	children?: ReactNode;
}) {
	return (
		<li className="relative flex flex-col gap-1">
			<span
				aria-hidden="true"
				className="absolute top-1.5 -left-[1.8rem] size-2.5 rounded-full border-2 border-background bg-foreground ring-1 ring-border"
			/>
			<h3 className="font-medium">
				{title}
				{meta && <span className="text-muted-foreground"> · {meta}</span>}
			</h3>
			{isWritten(period) && <p className="font-mono text-xs text-muted-foreground">{period}</p>}
			{children}
		</li>
	);
}

export function WorkPage() {
	return (
		<Page title="Work" description="Where I’ve worked and what I’ve studied.">
			<div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
				<Card>
					<CardHeader>
						<CardTitle>
							<h2>Experience</h2>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Timeline>
							{work.map((entry) => (
								<TimelineItem
									key={`${entry.org}-${entry.role}`}
									title={entry.role}
									meta={entry.org}
									period={entry.period}
								>
									{isWritten(entry.summary) && (
										<p className="text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
									)}
								</TimelineItem>
							))}
						</Timeline>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>
							<h2>Education</h2>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Timeline>
							{education.map((entry) => (
								<TimelineItem key={entry.school} title={entry.school} period={entry.period}>
									<p className="text-sm leading-relaxed text-muted-foreground">{entry.focus}</p>
								</TimelineItem>
							))}
						</Timeline>
					</CardContent>
				</Card>
			</div>
		</Page>
	);
}
