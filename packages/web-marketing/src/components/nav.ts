/**
 * The site's pages, in the order the header and the phone menu list them. Articles is listed only once the server
 * says they're on (`GET /api/articles`): never prerendered, so a page without them never shows the link.
 *
 * @module components/nav
 */

import { articlesQuery } from '@raineworks/web-marketing/components/articles';
import { useQuery } from '@tanstack/react-query';

export const NAV_LINKS = [
	{ to: '/', label: 'Home' },
	{ to: '/work', label: 'Work' },
	{ to: '/projects', label: 'Projects' },
	{ to: '/articles', label: 'Articles' },
	{ to: '/hobbies', label: 'Hobbies' },
	{ to: '/contact', label: 'Contact' },
] as const;

/** The pages to list: Articles only once the server says they're on. */
export function useNavLinks() {
	const articles = useQuery(articlesQuery()).data?.enabled === true;
	return NAV_LINKS.filter((link) => link.to !== '/articles' || articles);
}
