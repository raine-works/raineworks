/**
 * The site's pages, in the order the header and the phone menu list them.
 *
 * @module components/nav
 */

export const NAV_LINKS = [
	{ to: '/', label: 'Home' },
	{ to: '/work', label: 'Work' },
	{ to: '/projects', label: 'Projects' },
	{ to: '/hobbies', label: 'Hobbies' },
	{ to: '/contact', label: 'Contact' },
] as const;
