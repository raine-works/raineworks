import { describe, expect, test } from 'bun:test';

import { isWritten, projects } from '@raineworks/web-marketing/content/profile';

describe('the projects', () => {
	test('are listed alphabetically, a leading dot aside', () => {
		const names = projects.map((project) => project.name.replace(/^\./, ''));
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});

	test('link to their repositories on GitHub, named as each is, this site’s included', () => {
		for (const project of projects)
			expect(project.href, project.name).toBe(`https://github.com/raine-works/${project.name}`);
	});

	test('mark this site, and only it, as the one you’re looking at', () => {
		expect(projects.filter((project) => project.here).map((project) => project.name)).toEqual(['raineworks']);
	});

	test('feature three on the home page', () => {
		expect(projects.filter((project) => project.featured).length).toBe(3);
	});
});

describe('isWritten', () => {
	test('keeps copy still to be written off the page', () => {
		expect(isWritten('TODO(raine): a few sentences')).toBe(false);
		expect(isWritten('Self-hosting on my own hardware.')).toBe(true);
	});
});
