/**
 * The favicon follows the page's focus: the gradient mark (`assets/favicon.svg`, the zone's `<link rel="icon">`) while
 * the page has it, the mark in white on black (`assets/favicon-inactive.svg`) while another tab, window or app does.
 * `mountZone` connects it (`connectFavicon`); a browser that doesn't redraw a changed icon just keeps the gradient.
 *
 * @module lib/favicon
 */

import inactiveFavicon from '@raineworks/ui/assets/favicon-inactive.svg';

/** Swaps the page's icon with its focus, from now on. Call once, in the browser. */
export function connectFavicon(): void {
	const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	const active = link?.getAttribute('href');
	if (!link || !active) return;
	const update = () => {
		const href = document.visibilityState === 'visible' && document.hasFocus() ? active : inactiveFavicon;
		if (link.getAttribute('href') !== href) link.setAttribute('href', href);
	};
	window.addEventListener('focus', update);
	window.addEventListener('blur', update);
	document.addEventListener('visibilitychange', update);
	update();
}
