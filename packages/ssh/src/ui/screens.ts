/**
 * The TUI's screens, in the order the sidebar and the number keys list them: the site's pages, and About.
 *
 * @module ui/screens
 */

export const SCREENS = [
	{ id: 'home', label: 'Home', glyph: '⌂', hint: 'Who Raine is' },
	{ id: 'work', label: 'Work', glyph: '◆', hint: 'Experience and education' },
	{ id: 'projects', label: 'Projects', glyph: '▤', hint: 'Open source, on GitHub' },
	{ id: 'hobbies', label: 'Hobbies', glyph: '✦', hint: 'Away from the keyboard' },
	{ id: 'contact', label: 'Contact', glyph: '@', hint: 'Send a message' },
	{ id: 'about', label: 'About', glyph: '§', hint: 'This app, its version and licences' },
] as const;

/** One of {@link SCREENS}' ids. */
export type ScreenId = (typeof SCREENS)[number]['id'];

/** What the keys do: `nav` moves between screens, `form` types into the contact form, the overlays own the keys. */
export type Mode = 'nav' | 'form' | 'palette' | 'help';
