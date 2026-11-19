import { describe, expect, test } from 'bun:test';

import { articlesFeed } from '@raineworks/server/lib/rss';

describe('the articles’ feed', () => {
	test('is RSS 2.0: each article’s title, link, date and summary, escaped', () => {
		const xml = articlesFeed([
			{
				id: '7',
				title: 'Bits & <bytes>',
				summary: 'Says "hi"',
				url: 'https://x.com/raineworks/status/7',
				publishedAt: '2026-11-18T12:00:00.000Z',
			},
			{
				id: '6',
				title: 'Untold',
				summary: '',
				url: 'https://x.com/raineworks/status/6',
				publishedAt: '2026-11-01T00:00:00.000Z',
			},
		]);
		expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"');
		expect(xml).toContain('<link>https://raineworks.com/articles</link>');
		expect(xml).toContain('<lastBuildDate>Wed, 18 Nov 2026 12:00:00 GMT</lastBuildDate>');
		expect(xml).toContain(
			'<item><title>Bits &amp; &lt;bytes&gt;</title><link>https://x.com/raineworks/status/7</link><guid isPermaLink="true">https://x.com/raineworks/status/7</guid><pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate><description>Says &quot;hi&quot;</description></item>',
		);
		expect(xml.match(/<item>/g)).toHaveLength(2);
		expect(xml).not.toContain('<description></description>');
	});

	test('is a channel with no items when there are none yet', () => {
		const xml = articlesFeed([]);
		expect(xml).toContain('<channel>');
		expect(xml).not.toContain('<item>');
		expect(xml).not.toContain('lastBuildDate');
	});
});
