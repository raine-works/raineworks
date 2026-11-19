/**
 * Work: experience and education as one timeline, each entry's organisation a link (OSC 8, where the terminal
 * supports it).
 *
 * @module screens/work
 */

import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Heading } from '@raineworks/ssh/ui/panel';
import { education, isWritten, work } from '@raineworks/web-marketing/content/profile';
import type { ReactNode } from 'react';

function Entry({
	title,
	meta,
	period,
	children,
	last,
}: {
	title: ReactNode;
	meta?: ReactNode;
	period: string;
	children?: ReactNode;
	last?: boolean;
}) {
	return (
		<box style={{ flexDirection: 'row' }}>
			<box style={{ flexDirection: 'column', width: 3 }}>
				<text fg={theme.accent}>●</text>
				{!last && <text fg={theme.faint}>│</text>}
			</box>
			<box style={{ flexDirection: 'column', flexGrow: 1, marginBottom: last ? 0 : 1 }}>
				<text>
					<strong fg={theme.text}>{title}</strong>
					{meta && <span fg={theme.faint}> · </span>}
					{meta}
				</text>
				{isWritten(period) && <text fg={theme.dim}>{period}</text>}
				{children}
			</box>
		</box>
	);
}

export function Work() {
	return (
		<box style={{ flexDirection: 'column', padding: 1, paddingLeft: 2 }}>
			<Heading eyebrow="work" title="Where I’ve worked" />
			{work.map((entry, i) => (
				<Entry
					key={entry.org}
					title={sanitize(entry.role)}
					meta={
						<a href={entry.href} fg={theme.accent}>
							{sanitize(entry.org)}
						</a>
					}
					period={sanitize(entry.period)}
					last={i === work.length - 1}
				>
					{isWritten(entry.summary) && (
						<text fg={theme.muted} wrapMode="word">
							{sanitize(entry.summary)}
						</text>
					)}
				</Entry>
			))}
			<box style={{ height: 1 }} />
			<Heading eyebrow="education" title="What I’ve studied" />
			{education.map((entry, i) => (
				<Entry
					key={entry.school}
					title={sanitize(entry.school)}
					period={sanitize(entry.period)}
					last={i === education.length - 1}
				>
					<text fg={theme.muted}>{sanitize(entry.focus)}</text>
				</Entry>
			))}
		</box>
	);
}
