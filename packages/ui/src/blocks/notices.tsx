/**
 * About's legal tab (`blocks/release-notes`): the site's own licence (open source, MIT, as the root `LICENSE` says,
 * with a link to its source), and the third-party notices: the open-source packages this zone is built with and the
 * licence each is under, with its text, as most of those licences ask of whoever passes the code on.
 *
 * The zone's build lists what it bundled (`notices.json` beside its files, `@raineworks/tools/notices`); it's fetched
 * only once the tab is shown, and searched here by name or licence. Failing shows why with Retry (`QueryState`).
 * Packages that share a licence and its text (a project's usually do) are one row, so the list stays short, and a
 * licence's text is laid out as paragraphs the page wraps (`paragraphs`), in a box of its own that scrolls.
 *
 * @module blocks/notices
 */

import type { Notice, NoticesFile } from '@raineworks/tools/notices';
import '@raineworks/tools/prototypes';
import { plural } from '@raineworks/tools/text';
import { resolveZone, zonePublicPath } from '@raineworks/tools/zones';
import { QueryState } from '@raineworks/ui/blocks/query-state';
import { Input } from '@raineworks/ui/components/input';
import { apiFetch, unwrap } from '@raineworks/ui/lib/api';
import { APP_LICENSE, APP_NAME, COPYRIGHT_HOLDER, SOURCE_URL } from '@raineworks/ui/lib/brand';
import { APP_COMMIT } from '@raineworks/ui/lib/version';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

/** What the zone open is built with: nothing outside every zone, where no build is the page's. */
const noticesQuery = () => {
	const zone = resolveZone(location.pathname)?.zone;
	return queryOptions({
		queryKey: ['notices', zone ?? null] as const,
		queryFn: async (): Promise<Notice[]> => {
			if (!zone) return [];
			// A file of the zone's, not an API route. It isn't named by its content, so the commit keeps a cached copy
			// from the build before out of this one.
			const file: NoticesFile = await unwrap(apiFetch(`${zonePublicPath(zone)}notices.json?v=${APP_COMMIT}`));
			return file.notices;
		},
		staleTime: Number.POSITIVE_INFINITY,
	});
};

const matches = (notice: Notice, search: string) =>
	`${notice.name} ${notice.license}`.toLowerCase().includes(search.trim().toLowerCase());

/** Packages under one licence with one text: a project's packages share theirs, so they're shown once, together. */
interface NoticeGroup {
	license: string;
	text: string | null;
	packages: Notice[];
}

function grouped(notices: Notice[]): NoticeGroup[] {
	const groups = new Map<string, NoticeGroup>();
	for (const notice of notices) {
		const key = `${notice.license}\n${notice.text}`;
		const group = groups.get(key) ?? { license: notice.license, text: notice.text, packages: [] };
		group.packages.push(notice);
		groups.set(key, group);
	}
	return [...groups.values()];
}

/**
 * What a group is called: its one package, the scope its packages share (`@tanstack`), or the first of them (or its
 * scope) and how many others there are outside it (`@radix-ui and 1 other`, `react and 3 others`).
 */
function groupName({ packages }: NoticeGroup): string {
	const [first, ...rest] = packages.map((notice) => notice.name) as [string, ...string[]];
	if (rest.isEmpty()) return first;
	const scope = first.startsWith('@') ? first.slice(0, first.indexOf('/')) : null;
	const others = scope ? rest.filter((name) => !name.startsWith(`${scope}/`)).length : rest.length;
	const lead = scope ?? first;
	return others === 0 ? lead : `${lead} and ${plural(others, 'other')}`;
}

/** A line that starts an item of a list (`1.`, `(a)`, `*`, `-`), which begins a paragraph of its own. */
const LIST_ITEM = /^([-*•]|\d+\.|\([a-z0-9]+\))\s/i;

/**
 * A licence's text as paragraphs. The files are wrapped by hand at 70-odd characters and indented with spaces, which
 * a narrower column wraps again mid-line: each paragraph (up to a blank line, or the next list item) is joined into
 * one, for the page to wrap. Only white space changes, never a word.
 */
export function paragraphs(text: string): string[] {
	const result: string[] = [];
	let current: string[] = [];
	const end = () => {
		if (!current.isEmpty()) result.push(current.join(' '));
		current = [];
	};
	for (const line of text.split('\n').map((each) => each.trim().replace(/\s+/g, ' '))) {
		if (line.isEmpty() || LIST_ITEM.test(line)) end();
		if (!line.isEmpty()) current.push(line);
	}
	end();
	return result;
}

/** The site's own licence, then the packages this zone is built with, each opening to its licence's text. */
export function Legal() {
	return (
		<>
			<section className="grid gap-2">
				<h3 className="text-lg font-semibold">{APP_NAME}</h3>
				<p className="text-sm">
					{APP_NAME} is open source under the {APP_LICENSE.name}, © {COPYRIGHT_HOLDER}. You’re free to use, copy and
					change it, as long as the licence and copyright notice come with it.
				</p>
				<p className="text-sm">
					<a
						href={SOURCE_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium underline underline-offset-4 hover:text-brand-ink"
					>
						Source code and licence on GitHub
					</a>
				</p>
			</section>
			<section className="grid gap-4">
				<h3 className="text-lg font-semibold">Third-party notices</h3>
				<Notices />
			</section>
		</>
	);
}

function Notices() {
	const notices = useQuery(noticesQuery());
	const [search, setSearch] = useState('');
	return (
		<QueryState
			query={notices}
			isEmpty={(data) => data.isEmpty()}
			empty={<p className="text-sm text-muted-foreground">No third-party notices to show.</p>}
		>
			{(data) => {
				const found = data.filter((notice) => matches(notice, search));
				return (
					<div className="grid gap-4">
						<p className="text-sm text-muted-foreground">
							{APP_NAME} includes {plural(data.length, 'open-source package')}, each under its own licence. Those
							licences cover that package only; {APP_NAME}’s own is the {APP_LICENSE.name} above.
						</p>
						<Input
							type="search"
							aria-label="Search packages"
							placeholder="Search by package or licence"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						{found.isEmpty() ? (
							<p className="text-sm text-muted-foreground">No package matches “{search.trim()}”.</p>
						) : (
							<ul className="grid divide-y rounded-md border">
								{grouped(found).map((group) => (
									<GroupRow key={`${group.packages[0]?.name}@${group.packages[0]?.version}`} group={group} />
								))}
							</ul>
						)}
					</div>
				);
			}}
		</QueryState>
	);
}

function GroupRow({ group }: { group: NoticeGroup }) {
	const [only, ...others] = group.packages;
	return (
		<li>
			<details className="group/notice">
				<summary className="flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-sm hover:bg-muted/50">
					<ChevronRightIcon className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-open/notice:rotate-90" />
					<span className="min-w-0 font-medium wrap-break-word">{groupName(group)}</span>
					<span className="text-xs text-muted-foreground">
						{others.isEmpty() ? only?.version : plural(group.packages.length, 'package')}
					</span>
					<span className="ml-auto text-xs text-muted-foreground">{group.license}</span>
				</summary>
				{/* A box of its own that scrolls, so a long licence (Apache's) or a long list keeps the rest in reach. */}
				<div className="grid max-h-80 gap-3 overflow-y-auto border-t bg-muted/30 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
					{!others.isEmpty() && (
						<ul className="flex flex-wrap gap-x-3 gap-y-1 border-b pb-3 font-mono">
							{group.packages.map((notice) => (
								<li key={`${notice.name}@${notice.version}`}>
									{notice.name} {notice.version}
								</li>
							))}
						</ul>
					)}
					{group.text ? (
						paragraphs(group.text).map((paragraph, index) => (
							// The text never changes: its paragraphs keep their places.
							<p key={index} className="wrap-break-word">
								{paragraph}
							</p>
						))
					) : (
						<p>No licence text ships with it. It’s under {group.license}.</p>
					)}
				</div>
			</details>
		</li>
	);
}
