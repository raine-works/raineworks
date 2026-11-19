/**
 * Modals in the browser's history, so Back (the browser's, or Android's) closes the one on top.
 *
 * Each open dialog, sheet or alert has a history entry of its own, at the page's own address, whose state lists the
 * modals open at it (`raineworksModals`). Opening one pushes its entry; Back (or Forward) to an entry closes every modal it
 * doesn't list, as if dismissed; closing one any other way (its close button, Escape, a save) goes back over its
 * entry, so Forward never lands on a modal that's gone. A modal closed as another opens hands it its entry instead.
 * An entry whose modal isn't open (closed by navigating away, or from before a reload or a full page load, since
 * history outlives the page) is gone back over as it's reached, so Back never stops on it; Forward leaves it be.
 *
 * `Dialog`, `Sheet` and `AlertDialog` (`@raineworks/ui/components`) do this themselves through `useModalHistory`;
 * `mountZone` connects the zone's router (`connectModalHistory`). With no router connected, modals just open and close.
 *
 * A modal whose state is in the address (a `?panel=` parameter, say) keeps it there instead: it passes `inHistory: false`
 * and makes its own entries by navigating, and registers its parameter (`addModalParam`), so moving between them is
 * still the same page.
 *
 * The router scrolls to the top on every history change; moving between a page's own entries keeps it where it was.
 *
 * @module lib/modal-history
 */

import '@raineworks/tools/prototypes';
import type { AnyRouter, RouterHistory } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useState } from 'react';

const KEY = 'raineworksModals';

interface Modal {
	id: string;
	close: () => void;
	/** Its entry is in history. */
	entered: boolean;
}

let router: AnyRouter | null = null;
/** The open modals, oldest first. */
let stack: Modal[] = [];
/** A Back of ours is on its way. */
let goingBack = false;
let settleQueued = false;
/** Where the page was scrolled as it moved between its own entries, to put it back after the router scrolls up. */
let keepScroll: { entry: string | undefined; x: number; y: number } | null = null;
/** Search parameters that hold a modal's state (`addModalParam`): changing one stays on the same page. */
const modalParams = new Set<string>();

/** Registers a search parameter that holds a modal's state, such as `panel`. */
export function addModalParam(name: string): void {
	modalParams.add(name);
}

/** The page an address is, whatever modals its parameters have open. */
function pageOf(href: string): string {
	const url = new URL(href, 'http://raineworks');
	for (const name of modalParams) url.searchParams.delete(name);
	return `${url.pathname}${url.search}${url.hash}`;
}

const modalsAt = (location: { state: object }): string[] => {
	const ids: unknown = Reflect.get(location.state, KEY);
	return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
};

/** Writes the entry for `modal`: pushed over the current one, or replacing it (one closing as this one opens). */
function enter(history: RouterHistory, modal: Modal, replace: boolean) {
	modal.entered = true;
	const ids = stack.filter((open) => open.entered).map((open) => open.id);
	const { href, state } = history.location;
	history[replace ? 'replace' : 'push'](href, { ...state, [KEY]: ids });
}

/**
 * Brings history in line with the open modals: one step at a time, since a Back lands later. `skipStale`: go back over
 * an entry whose modal isn't open (not after Forward, which would only bounce back).
 */
function settle(skipStale = true) {
	if (!router || goingBack) return;
	const history: RouterHistory = router.history;
	const top = modalsAt(history.location).at(-1);
	const waiting = stack.find((modal) => !modal.entered);
	if (top !== undefined && !stack.some((modal) => modal.id === top)) {
		if (waiting) {
			enter(history, waiting, true);
			return settle();
		}
		if (skipStale && history.canGoBack()) {
			goingBack = true;
			history.back();
		}
		return;
	}
	if (waiting) {
		enter(history, waiting, false);
		settle();
	}
}

function queueSettle() {
	if (settleQueued) return;
	settleQueued = true;
	queueMicrotask(() => {
		settleQueued = false;
		settle();
	});
}

/** Puts a zone's router's history in charge of its modals. Call once, before it renders (`mountZone`). */
export function connectModalHistory(next: AnyRouter): () => void {
	router = next;
	stack = [];
	goingBack = false;
	keepScroll = null;
	const history: RouterHistory = next.history;
	let current = history.location;
	const stopHistory = history.subscribe(({ location, action }) => {
		const from = current;
		current = location;
		const open = modalsAt(location);
		const modalsChanged = from.href !== location.href || modalsAt(from).join() !== open.join();
		keepScroll =
			typeof window !== 'undefined' && modalsChanged && pageOf(from.href) === pageOf(location.href)
				? { entry: location.state.__TSR_key, x: window.scrollX, y: window.scrollY }
				: null;
		if (action.type === 'PUSH' || action.type === 'REPLACE') return;
		// Back, Forward or a jump: what this entry doesn't list closes.
		goingBack = false;
		const closed = stack.filter((modal) => modal.entered && !open.includes(modal.id));
		stack = stack.filter((modal) => !closed.includes(modal));
		for (const modal of closed) modal.close();
		settle(action.type === 'BACK' || (action.type === 'GO' && action.index < 0));
	});
	const stopRendered = next.subscribe('onRendered', ({ toLocation }) => {
		if (keepScroll && typeof window !== 'undefined' && keepScroll.entry === toLocation.state.__TSR_key) {
			window.scrollTo(keepScroll.x, keepScroll.y);
		}
		keepScroll = null;
	});
	// A page loaded at a modal's entry (a reload, or Back from another zone) has nothing open: off it.
	settle();
	return () => {
		stopHistory();
		stopRendered();
		if (router === next) router = null;
	};
}

/**
 * Records a modal as open, giving it an entry in history; `close` is how Back closes it. Returns what to call once
 * it's closed (however it was), which goes back over its entry.
 */
export function openModal(close: () => void): () => void {
	if (!router) return () => {};
	const modal: Modal = { id: crypto.randomUUID(), close, entered: false };
	stack = [...stack, modal];
	queueSettle();
	return () => {
		// Back closed it already.
		if (!stack.includes(modal)) return;
		stack = stack.filter((open) => open !== modal);
		queueSettle();
	};
}

/**
 * A modal's open state, kept in history while it's open. Takes a Radix root's `open`, `defaultOpen` and
 * `onOpenChange` and hands back the `open` and `onOpenChange` to give it: controlled or not, Back closes it as if it
 * were dismissed (`onOpenChange(false)`), and one kept open regardless is entered again. `inHistory: false` for a modal whose state is in the address, which makes
 * its own entries.
 */
export function useModalHistory({
	open,
	defaultOpen = false,
	onOpenChange,
	inHistory = true,
}: {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	inHistory?: boolean;
}): { open: boolean; onOpenChange: (open: boolean) => void } {
	const [uncontrolled, setUncontrolled] = useState(defaultOpen);
	// Counts the Backs that closed it: a controlled modal that stays open anyway (busy saving, say) gets a new entry.
	const [backs, setBacks] = useState(0);
	const isOpen = open ?? uncontrolled;
	const change = (next: boolean) => {
		if (open === undefined) setUncontrolled(next);
		onOpenChange?.(next);
	};
	const close = useEffectEvent(() => {
		change(false);
		setBacks((count) => count + 1);
	});
	useEffect(() => {
		if (isOpen && inHistory) return openModal(close);
	}, [isOpen, inHistory, backs]);
	return { open: isOpen, onOpenChange: change };
}
