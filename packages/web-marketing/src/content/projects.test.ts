import { describe, expect, test } from 'bun:test';

import '@raineworks/tools/prototypes';
import { DOCS_SOURCES, isDocsProject } from '@raineworks/tools/docs';
import { projectPages } from '@raineworks/web-marketing/content/project-pages';
import { projectByRepo, projectBySlug, projects } from '@raineworks/web-marketing/content/projects';

/** Every piece of a page's text, for the checks every one must pass. */
const allText = (slug: string): string[] => {
	const page = projectPages[slug];
	if (!page) return [];
	return [
		...page.overview,
		...page.highlights.flatMap((highlight) => [highlight.title, highlight.text]),
		...page.sections.flatMap((section) => [section.heading, ...section.body, ...(section.points ?? [])]),
	];
};

describe('the projects’ pages', () => {
	test('each listed project has its page’s words, and nothing else does', () => {
		expect(Object.keys(projectPages).sort()).toEqual(projects.map((project) => project.slug).sort());
	});

	test('have addresses of their own: lowercase, URL-safe and unique', () => {
		for (const { slug } of projects) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		expect(projects.map((project) => project.slug).unique()).toHaveLength(projects.length);
		expect(projects.map((project) => project.repo).unique()).toHaveLength(projects.length);
	});

	test('with documentation are projects with a page, built from their repository', () => {
		for (const [slug, source] of Object.entries(DOCS_SOURCES)) {
			expect(isDocsProject(slug)).toBe(true);
			expect(projectBySlug(slug)?.repo).toBe(source.repo);
		}
	});

	test('are found by their address and by their repository', () => {
		expect(projectBySlug('dotfiles')?.repo).toBe('.dotfiles');
		expect(projectByRepo('.dotfiles')?.slug).toBe('dotfiles');
		expect(projectBySlug('nope')).toBeUndefined();
	});

	test('sum themselves up in a sentence that fits a search result', () => {
		const outside = projects.filter(({ summary }) => summary.length < 80 || summary.length > 180);
		expect(outside.map((project) => project.slug)).toEqual([]);
	});

	test('say enough: an overview, a few highlights, and a section or more', () => {
		for (const { slug } of projects) {
			const page = projectPages[slug];
			expect(page?.overview.isEmpty()).toBe(false);
			expect(page?.highlights.length).toBeGreaterThanOrEqual(3);
			expect(page?.sections.isEmpty()).toBe(false);
		}
	});

	test('use typographic quotes and plain text: no straight quotes, no Markdown, nothing blank', () => {
		for (const { slug, title, summary } of projects) {
			for (const text of [title, summary, ...allText(slug)]) {
				expect({ slug, text }).toEqual({ slug, text: expect.not.stringMatching(/['"`*<>]|\]\(/) });
				expect(text.trim().isEmpty()).toBe(false);
			}
		}
	});
});
