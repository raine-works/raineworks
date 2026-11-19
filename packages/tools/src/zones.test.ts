import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import '@raineworks/tools/prototypes';
import { isZoneId, resolveZone, safeRedirectPath, zoneHref, zonePublicPath } from '@raineworks/tools/zones';

describe('zones', () => {
	test('isZoneId accepts only a zone’s id', () => {
		expect(isZoneId('marketing')).toBe(true);
		expect(isZoneId('x')).toBe(false);
		expect(isZoneId('toString')).toBe(false);
		expect(isZoneId('__proto__')).toBe(false);
		expect(isZoneId(null)).toBe(false);
	});

	test('every path no other zone claims is the root zone’s', () => {
		expect(resolveZone('/')).toEqual({ zone: 'marketing', path: '' });
		expect(resolveZone('/projects')).toEqual({ zone: 'marketing', path: 'projects' });
		expect(resolveZone('/chunk-abc.js')).toEqual({ zone: 'marketing', path: 'chunk-abc.js' });
		expect(resolveZone('//work/')).toEqual({ zone: 'marketing', path: 'work/' });
	});

	test('builds hrefs and public paths for the root zone', () => {
		expect(zoneHref('marketing')).toBe('/');
		expect(zoneHref('marketing', '/projects')).toBe('/projects');
		expect(zoneHref('marketing', 'contact')).toBe('/contact');
		expect(zonePublicPath('marketing')).toBe('/');
	});

	test('only same-origin paths are safe redirects', () => {
		expect(safeRedirectPath('/projects')).toBe('/projects');
		expect(safeRedirectPath('//evil.example')).toBeNull();
		expect(safeRedirectPath('/\\evil.example')).toBeNull();
		expect(safeRedirectPath('https://evil.example')).toBeNull();
		expect(safeRedirectPath(null)).toBeNull();
		// Browsers strip tabs and newlines from URLs: these would read as `//evil.example`.
		expect(safeRedirectPath('/\t/evil.example')).toBeNull();
		expect(safeRedirectPath('/\n/evil.example')).toBeNull();
		expect(safeRedirectPath('/\r\n/evil.example')).toBeNull();
		expect(safeRedirectPath('/\u0000/evil.example')).toBeNull();
		expect(safeRedirectPath('/projects?tab=1#top')).toBe('/projects?tab=1#top');
		expect(safeRedirectPath('/work/../contact')).toBe('/contact');
	});

	test('no zone’s index.html has an inline script or an on*= attribute', async () => {
		const pages = [...new Bun.Glob('web-*/index.html').scanSync(join(import.meta.dir, '../..'))];
		expect(pages.isEmpty()).toBe(false);
		for (const page of pages) {
			const html = await Bun.file(join(import.meta.dir, '../..', page)).text();
			for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) expect(tag, page).toContain(' src=');
			expect(html, page).not.toMatch(/\son[a-z]+\s*=/i);
		}
	});
});
