/**
 * The articles as an RSS 2.0 feed (`GET /feed.xml`): each one's title, summary and date, linking to it on x.com.
 *
 * @module lib/rss
 */

import type { Article } from '@raineworks/server/lib/x';
import { X_HANDLE } from '@raineworks/server/lib/x';

/** Where the site is public: the feed's links are absolute against it. */
const SITE_URL = 'https://raineworks.com';

const escapeXml = (text: string) =>
	text.replace(
		/[<>&'"]/g,
		(char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char,
	);

/** `articles` (newest first) as an RSS document. */
export function articlesFeed(articles: Article[]): string {
	const items = articles.map((article) =>
		[
			'<item>',
			`<title>${escapeXml(article.title)}</title>`,
			`<link>${escapeXml(article.url)}</link>`,
			`<guid isPermaLink="true">${escapeXml(article.url)}</guid>`,
			`<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`,
			article.summary ? `<description>${escapeXml(article.summary)}</description>` : '',
			'</item>',
		].join(''),
	);
	const updated = articles[0]
		? `<lastBuildDate>${new Date(articles[0].publishedAt).toUTCString()}</lastBuildDate>`
		: '';
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
		'<channel>',
		'<title>Raine Petersen’s articles</title>',
		`<link>${SITE_URL}/articles</link>`,
		`<atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
		`<description>Articles Raine Petersen writes on X (@${X_HANDLE}).</description>`,
		'<language>en</language>',
		updated,
		...items,
		'</channel>',
		'</rss>',
		'',
	].join('\n');
}
