import { describe, expect, test } from 'bun:test';

import { THEME_SCRIPT } from '@raineworks/ui/hooks/use-theme';
import { documentTitle, headTags } from '@raineworks/ui/lib/head';

const content = (html: string, attribute: string, name: string) =>
	html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)" />`))?.[1];

describe('a page’s head', () => {
	test('titles the page after the site, or names the site alone', () => {
		expect(documentTitle('Work')).toBe('Work · raineworks');
		expect(documentTitle()).toBe('raineworks');
	});

	test('says what the page is, where it lives, and unfurls with the share image, absolute', () => {
		const html = headTags(
			{ title: 'Work', description: 'Where I’ve worked.' },
			{ url: 'https://raineworks.com/work', image: '/og-image-abcdefgh.png' },
		);
		expect(html).toContain('<title>Work · raineworks</title>');
		expect(html).toContain('<link rel="canonical" href="https://raineworks.com/work" />');
		expect(content(html, 'name', 'description')).toBe('Where I’ve worked.');
		expect(content(html, 'property', 'og:title')).toBe('Work · raineworks');
		expect(content(html, 'property', 'og:url')).toBe('https://raineworks.com/work');
		expect(content(html, 'property', 'og:image')).toBe('https://raineworks.com/og-image-abcdefgh.png');
		expect(content(html, 'property', 'og:image:width')).toBe('1200');
		expect(content(html, 'name', 'twitter:card')).toBe('summary_large_image');
		expect(content(html, 'name', 'twitter:image')).toBe('https://raineworks.com/og-image-abcdefgh.png');
		expect(html).not.toContain('robots');
	});

	test('keeps a page out of search results when asked, with no canonical address', () => {
		const html = headTags({ title: 'Page not found', description: 'Nothing here.', noindex: true }, { url: null });
		expect(content(html, 'name', 'robots')).toBe('noindex');
		expect(html).not.toContain('canonical');
		expect(html).not.toContain('og:url');
		expect(content(html, 'name', 'twitter:card')).toBe('summary');
	});

	test('escapes what it’s given, so nothing in a description can end its tag or a script', () => {
		const html = headTags(
			{
				description: 'A "quoted" <b>bold</b> & more',
				structuredData: { '@type': 'Person', name: '</script><script>' },
			},
			{ url: null },
		);
		expect(content(html, 'name', 'description')).toBe('A &quot;quoted&quot; &lt;b&gt;bold&lt;/b&gt; &amp; more');
		const json = html.match(/<script type="application\/ld\+json">(.*)<\/script>/)?.[1] ?? '';
		expect(json).not.toContain('</script>');
		expect(JSON.parse(json)).toEqual({
			'@context': 'https://schema.org',
			'@type': 'Person',
			name: '</script><script>',
		});
	});
});

describe('the theme script', () => {
	/** Runs the script against a stored theme (or storage that throws) and a system scheme; whether `dark` was set. */
	function run(stored: string | null | Error, systemDark: boolean): boolean {
		let dark: boolean | undefined;
		const scope = {
			localStorage: {
				getItem: () => {
					if (stored instanceof Error) throw stored;
					return stored;
				},
			},
			matchMedia: () => ({ matches: systemDark }),
			document: {
				documentElement: {
					classList: {
						toggle: (name: string, on: boolean) => {
							if (name === 'dark') dark = on;
						},
					},
				},
			},
		};
		new Function('localStorage', 'matchMedia', 'document', THEME_SCRIPT)(
			scope.localStorage,
			scope.matchMedia,
			scope.document,
		);
		if (dark === undefined) throw new Error('The script never set the scheme.');
		return dark;
	}

	test('applies the stored scheme before anything paints, else the system’s', () => {
		expect(run('dark', false)).toBe(true);
		expect(run('light', true)).toBe(false);
		expect(run('system', true)).toBe(true);
		expect(run(null, false)).toBe(false);
	});

	test('follows the system where storage is refused', () => {
		expect(run(new Error('SecurityError'), true)).toBe(true);
	});
});
