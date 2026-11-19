import { describe, expect, test } from 'bun:test';

import {
	contentHashedName,
	hydrateAfterLoad,
	pageFile,
	type PrerenderedPage,
	renderPage,
	sitemapXml,
} from '@raineworks/tools/build';
import { isContentHashed } from '@raineworks/tools/http';

const bytes = (text: string) => new TextEncoder().encode(text);

const page = (path: string, status: 200 | 404 = 200): PrerenderedPage => ({
	path,
	status,
	head: `<title>${path}</title>`,
	markup: `<main>${path}</main>`,
});

describe('a content-hashed name', () => {
	test('is one the server caches for a year, the same for the same bytes and different for others', () => {
		const name = contentHashedName('og-image.png', bytes('a'));
		expect(name).toMatch(/^og-image-[0-9a-z]{8}\.png$/);
		expect(isContentHashed(name)).toBe(true);
		expect(contentHashedName('og-image.png', bytes('a'))).toBe(name);
		expect(contentHashedName('og-image.png', bytes('b'))).not.toBe(name);
	});

	test('keeps every dot but the extension’s in the name', () => {
		expect(contentHashedName('geist-latin.wght.woff2', bytes('a'))).toMatch(/^geist-latin\.wght-[0-9a-z]{8}\.woff2$/);
	});
});

describe('a prerendered page', () => {
	test('is written where the server looks for its path, the 404 on its own', () => {
		expect(pageFile(page('/'))).toBe('index.html');
		expect(pageFile(page('/work'))).toBe('work/index.html');
		expect(pageFile(page('/work/'))).toBe('work/index.html');
		expect(pageFile(page('/anything', 404))).toBe('404.html');
	});

	test('takes the template’s title for its head and fills #root with its markup', () => {
		const template =
			'<html><head><title>raineworks</title><link rel="stylesheet" href="/a.css"></head><body><div id="root"></div></body></html>';
		const html = renderPage(template, { ...page('/work'), head: '<title>Work $& · raineworks</title>' });
		expect(html).toBe(
			'<html><head><title>Work $& · raineworks</title><link rel="stylesheet" href="/a.css"></head><body><div id="root"><main>/work</main></div></body></html>',
		);
	});

	test('can’t be rendered into a template with no title or no empty #root', () => {
		expect(() => renderPage('<head></head><div id="root"></div>', page('/'))).toThrow('<title>');
		expect(() => renderPage('<title>x</title><div id="app"></div>', page('/'))).toThrow('<title>');
	});
});

describe('the sitemap', () => {
	test('lists every page found, absolute, under the zone’s path, and not the 404 nor one unlisted', () => {
		const xml = sitemapXml(
			[page('/'), page('/work'), { ...page('/articles'), unlisted: true }, page('/nope', 404)],
			'https://raineworks.com',
			'/',
		);
		expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual([
			'https://raineworks.com/',
			'https://raineworks.com/work',
		]);
		const nested = sitemapXml([page('/'), page('/a&b')], 'https://raineworks.com', '/admin/');
		expect([...nested.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual([
			'https://raineworks.com/admin/',
			'https://raineworks.com/admin/a&#38;b',
		]);
	});
});

describe('hydrating after the first paint', () => {
	const built =
		'<head><title>x</title><link rel="stylesheet" crossorigin href="/a.css"><script type="module" crossorigin src="/entry.js"></script><link rel="modulepreload" crossorigin href="/dep.js"></head><body></body>';

	test('takes the module script and its preloads out of the page, for an inline script to load once it has painted', () => {
		const html = hydrateAfterLoad(built);
		expect(html).not.toContain('<script type="module"');
		expect(html).not.toMatch(/<link[^>]*modulepreload/);
		expect(html).toContain('<link rel="stylesheet" crossorigin href="/a.css">');
		const script = html.match(/<script>(.+)<\/script><\/head>/)?.[1] ?? '';
		expect(script).toContain('first-contentful-paint');
		expect(script).toContain('["/dep.js"]');
		expect(script).toContain('import("/entry.js")');
	});

	test('leaves a page with no module script as it is', () => {
		const html = '<head><title>x</title></head><body></body>';
		expect(hydrateAfterLoad(html)).toBe(html);
	});
});
