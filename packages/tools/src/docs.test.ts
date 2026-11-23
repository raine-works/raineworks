import { describe, expect, test } from 'bun:test';

import {
	DOCS_PAGE_PATTERN,
	DOCS_SOURCES,
	docsPath,
	docsRepoUrl,
	isDocsPage,
	isDocsProject,
} from '@raineworks/tools/docs';
import { highlight } from '@raineworks/tools/highlight';

describe('the documented projects', () => {
	test('are found by their slug, never by an inherited property', () => {
		expect(isDocsProject('ha-dashboards')).toBe(true);
		expect(isDocsProject('dotfiles')).toBe(true);
		expect(isDocsProject('nope')).toBe(false);
		expect(isDocsProject('constructor')).toBe(false);
		expect(isDocsProject('toString')).toBe(false);
	});

	test('have their pages at the site’s routes and their files on GitHub', () => {
		expect(docsPath('ha-dashboards')).toBe('/projects/ha-dashboards/docs');
		expect(docsPath('ha-dashboards', 'reference/modules')).toBe('/projects/ha-dashboards/docs/reference/modules');
		expect(docsRepoUrl('ha-dashboards', 'AGENTS.md')).toBe(
			'https://github.com/raine-works/ha-dashboards/blob/master/AGENTS.md',
		);
		expect(docsRepoUrl('ha-dashboards')).toBe('https://github.com/raine-works/ha-dashboards');
		expect(new Set(Object.values(DOCS_SOURCES).map((source) => source.dir))).toEqual(new Set(['docs']));
	});

	test('name pages with lowercase letters, digits and hyphens, one `/` at most', () => {
		expect(isDocsPage('reference/modules')).toBe(true);
		expect(isDocsPage('a/b/c')).toBe(false);
		expect(isDocsPage('../x')).toBe(false);
		expect(DOCS_PAGE_PATTERN.test('Upper')).toBe(false);
	});
});

describe('code in YAML', () => {
	test('is coloured, as `yml` too', () => {
		expect(highlight('views:\n  - title: Home\n', 'yaml')).toContain('hljs-attr');
		expect(highlight('a: 1', 'yml')).toContain('hljs-attr');
	});
});
