import { describe, expect, test } from 'bun:test';

import { isWritten, projects } from '@raineworks/web-marketing/content/profile';

describe('the projects', () => {
	test('are listed alphabetically, a leading dot aside', () => {
		const names = projects.map((project) => project.name.replace(/^\./, ''));
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});

	test('link to their repositories on GitHub, but for this site', () => {
		for (const project of projects.filter((each) => each.name !== 'raineworks'))
			expect(project.href, project.name).toStartWith('https://github.com/raine-works/');
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
