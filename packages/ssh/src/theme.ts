/**
 * The TUI's colours: the site's monochrome palette on a dark canvas it paints itself (so it looks the same in any
 * terminal), and a rain-blue accent for what's live or chosen. True colour; terminals without it round to their
 * nearest.
 *
 * @module theme
 */

export const theme = {
	/** The canvas, painted behind everything. */
	bg: '#09090b',
	/** A raised surface: the sidebar, cards. */
	panel: '#111114',
	/** What's under the pointer or chosen in a list. */
	raised: '#1c1c21',
	border: '#27272a',
	borderFocus: '#52525b',
	text: '#fafafa',
	muted: '#a1a1aa',
	dim: '#71717a',
	faint: '#3f3f46',
	/** What's live or chosen: the current screen, focus, links. */
	accent: '#7dd3fc',
	accentStrong: '#38bdf8',
	/** Rain, from far to near. */
	rain: ['#16324a', '#24557a', '#3b82b6', '#7dd3fc'] as const,
	/** The ASCII title's gradient, top to bottom. */
	title: ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8'] as const,
	success: '#4ade80',
	warning: '#fbbf24',
	danger: '#f87171',
} as const;
