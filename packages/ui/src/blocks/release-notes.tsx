/**
 * What's new: the app's release notes (`release-notes/<version>.md`, one per
 * `YEAR.MONTH.N` release, rendered at build time), newest first. Each zone
 * sees only what's for it: a note's `::: for <zones>` parts show only in those
 * zones, the rest everywhere, and a release with nothing for the zone isn't
 * listed (one zone's people never read another's changes).
 *
 * - `ReleaseNotes` (once, in `ZoneRoot`) is the dialog, About: the notes under
 *   **What's new**, and whose the app is and what the zone is built with
 *   under **Legal** (`blocks/notices`). It checks for updates too (`lib/version`).
 *   Any page opens it, on the notes, with `openReleaseNotes()`.
 * - `VersionLabel` shows the version and commit this page is, and opens it.
 * - `useUnseenRelease` says whether there's a release for this zone newer
 *   than the last one seen here on this device (a menu can show a dot).
 *
 * The list of releases (titles) loads with the page; each note's text when
 * the dialog shows it, its own chunk. Either failing shows why with Retry
 * (`QueryState`), or Reload once the chunk is gone after a release.
 *
 * @module blocks/release-notes
 */

import { compareVersions } from '@raineworks/tools/calver';
import type { DocMeta, RenderedDoc } from '@raineworks/tools/markdown';
import '@raineworks/tools/prototypes';
import { resolveZone } from '@raineworks/tools/zones';
import { Legal } from '@raineworks/ui/blocks/notices';
import { QueryState } from '@raineworks/ui/blocks/query-state';
import { Badge } from '@raineworks/ui/components/badge';
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTab,
	DialogTabs,
	DialogTabsList,
	DialogTitle,
} from '@raineworks/ui/components/dialog';
import { APP_NAME } from '@raineworks/ui/lib/brand';
import { readStored, writeStored } from '@raineworks/ui/lib/browser-storage';
import { formatPlainDate } from '@raineworks/ui/lib/format';
import { cn } from '@raineworks/ui/lib/utils';
import { APP_COMMIT, APP_VERSION, useUpdateCheck } from '@raineworks/ui/lib/version';
import { useQuery } from '@tanstack/react-query';
import { type MouseEvent, useSyncExternalStore } from 'react';

type Note = DocMeta & { load: () => Promise<{ default: RenderedDoc }> };

// ---------------------------------------------------------------------------
// Open or not, and what was last seen (shared by every caller)
// ---------------------------------------------------------------------------

/** Per zone: each zone has its own notes, so what's unread differs. */
const seenKey = () => `raineworks.releaseNotes.seen.${resolveZone(location.pathname)?.zone ?? 'unknown'}`;
const listeners = new Set<() => void>();
let open = false;
/** The newest release with something for this zone, once the notes have loaded. */
let newest: string | null = null;
const notify = () => {
	for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** Opens About on What's new, from anywhere. */
export function openReleaseNotes() {
	open = true;
	if (newest) markSeen(newest);
	notify();
}

function readSeen(): string | null {
	return readStored(seenKey());
}

function markSeen(version: string) {
	// Not remembered if storage is refused: the dot shows again next time.
	writeStored(seenKey(), version);
	notify();
}

/** Whether there's a release for this zone newer than the last one opened here (on this device). */
export function useUnseenRelease(): boolean {
	return useSyncExternalStore(subscribe, unseen, () => false);
}

function unseen(): boolean {
	const seen = readSeen();
	return newest !== null && (seen === null || compareVersions(newest, seen) > 0);
}

// ---------------------------------------------------------------------------
// The notes
// ---------------------------------------------------------------------------

/** Whether a part (or a whole note) is for the zone open: `null` zones are everyone's (`::: for …`, `@raineworks/tools/markdown`). */
const forThisZone = (zones: string[] | null) => {
	const zone = resolveZone(location.pathname)?.zone;
	return zones === null || (zone !== undefined && zones.includes(zone));
};

/** The releases with something for this zone, newest first: just their titles (each note's text loads with it). */
const notesQuery = () => ({
	queryKey: ['release-notes'] as const,
	queryFn: async (): Promise<Note[]> => {
		const { docs } = await import('raineworks:release-notes');
		const notes = docs.filter((note) => forThisZone(note.zones));
		newest = notes[0]?.slug ?? null;
		// Opened before they loaded: they're seen now they're shown.
		if (open && newest) markSeen(newest);
		else notify();
		return notes;
	},
	staleTime: Number.POSITIVE_INFINITY,
});

/** About's tabs. A dialog closed and opened again starts on the first: its content isn't kept. */
const TABS = [
	{ value: 'whats-new', label: 'What’s new' },
	{ value: 'legal', label: 'Legal' },
] as const;

/** About (What's new and Legal), and the update check: mounted once by `ZoneRoot`. */
export function ReleaseNotes() {
	const isOpen = useSyncExternalStore(
		subscribe,
		() => open,
		() => false,
	);
	useUpdateCheck(openReleaseNotes);
	// The list is small (titles, not text): loaded at once, so the menu can show a dot for an unread one.
	const notes = useQuery(notesQuery());
	const setOpen = (next: boolean) => {
		if (next) return openReleaseNotes();
		open = false;
		notify();
	};
	return (
		<Dialog open={isOpen} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTabs defaultValue={TABS[0].value}>
					<DialogHeader tabs={<DialogTabsList tabs={TABS} />}>
						<DialogTitle>About {APP_NAME}</DialogTitle>
						<DialogDescription>
							You’re on {APP_NAME} {APP_VERSION} ({APP_COMMIT}).
						</DialogDescription>
					</DialogHeader>
					<DialogBody>
						<DialogTab value="whats-new">
							<QueryState
								query={notes}
								isEmpty={(data) => data.isEmpty()}
								empty={<p className="text-sm text-muted-foreground">No release notes yet.</p>}
							>
								{(data) => (
									<ol className="grid gap-8">
										{data.map((note) => (
											<NoteView key={note.slug} note={note} />
										))}
									</ol>
								)}
							</QueryState>
						</DialogTab>
						<DialogTab value="legal">
							<Legal />
						</DialogTab>
					</DialogBody>
				</DialogTabs>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Rendered Markdown links each heading to itself (`#everywhere`, for a page of guides). In a dialog that's a link to
 * nowhere, and following one adds a history entry that isn't the dialog's, which closes it as Back would
 * (`lib/modal-history`): the headings aren't links here (no `#` on hover, nothing to click), and one followed
 * anyway (from the keyboard) goes nowhere.
 */
function stayOnPage(event: MouseEvent<HTMLDivElement>) {
	if (event.target instanceof Element && event.target.closest('a[href^="#"]')) event.preventDefault();
}

function NoteView({ note }: { note: Note }) {
	const body = useQuery({
		queryKey: ['release-notes', note.slug],
		queryFn: async () => (await note.load()).default,
		staleTime: Number.POSITIVE_INFINITY,
	});
	return (
		<li className="grid gap-3">
			<div className="grid gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="text-lg font-semibold">{note.title}</h3>
					{note.slug === APP_VERSION && <Badge variant="secondary">Yours</Badge>}
				</div>
				<p className="text-xs text-muted-foreground">
					{note.slug}
					{note.date && ` · ${formatPlainDate(note.date)}`}
				</p>
			</div>
			<QueryState query={body} loading="inline">
				{(doc) => (
					// Only the parts for this zone: a zone's people never read another's changes. The project's own text,
					// rendered at build time with raw HTML refused.
					<div
						className="guide text-sm [&_:is(h2,h3)>a]:pointer-events-none [&_:is(h2,h3)>a]:after:hidden"
						onClick={stayOnPage}
						dangerouslySetInnerHTML={{
							__html: doc.sections
								.filter((section) => forThisZone(section.zones))
								.map((section) => section.html)
								.join(''),
						}}
					/>
				)}
			</QueryState>
		</li>
	);
}

/** The version and commit this page is (`raineworks 2026.11.1 · 3ef4fe3`), opening About. */
export function VersionLabel({ className }: { className?: string }) {
	return (
		<button
			type="button"
			onClick={openReleaseNotes}
			className={cn(
				'w-fit rounded px-1 font-mono text-[11px] text-muted-foreground/80 hover:text-foreground focus-visible:text-foreground',
				className,
			)}
			title={`About ${APP_NAME}`}
		>
			{APP_NAME} {APP_VERSION} · {APP_COMMIT}
		</button>
	);
}
