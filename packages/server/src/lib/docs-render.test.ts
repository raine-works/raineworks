import { describe, expect, test } from 'bun:test';

import {
	docsNav,
	renderDocsPage,
	resolveDocsLink,
	splitTitle,
	stripHtmlComments,
} from '@raineworks/server/lib/docs-render';

const resolve = (href: string, file = 'docs/README.md') => resolveDocsLink(href, 'ha-dashboards', file);

describe('a docs page’s links', () => {
	test('between pages of the docs folder are the site’s routes', () => {
		expect(resolve('installation.md')).toEqual({ href: '/projects/ha-dashboards/docs/installation', external: false });
		expect(resolve('reference/modules.md')).toEqual({
			href: '/projects/ha-dashboards/docs/reference/modules',
			external: false,
		});
		expect(resolve('./cards.md#the-house-option')).toEqual({
			href: '/projects/ha-dashboards/docs/cards#the-house-option',
			external: false,
		});
	});

	test('are resolved from the page they’re in', () => {
		const from = 'docs/reference/modules.md';
		expect(resolve('options.md', from).href).toBe('/projects/ha-dashboards/docs/reference/options');
		expect(resolve('../installation.md', from).href).toBe('/projects/ha-dashboards/docs/installation');
		expect(resolve('../README.md', from).href).toBe('/projects/ha-dashboards/docs');
		expect(resolve('../../README.md', from)).toEqual({
			href: 'https://github.com/raine-works/ha-dashboards/blob/master/README.md',
			external: true,
		});
	});

	test('to the docs index are the docs route, however they spell it', () => {
		for (const href of ['README.md', './README.md', '../docs/README.md', '.', '../docs/', '../docs'])
			expect(resolve(href).href).toBe('/projects/ha-dashboards/docs');
	});

	test('to a file elsewhere in the repository are its page on GitHub', () => {
		expect(resolve('../AGENTS.md')).toEqual({
			href: 'https://github.com/raine-works/ha-dashboards/blob/master/AGENTS.md',
			external: true,
		});
		expect(resolve('/LICENSE').href).toBe('https://github.com/raine-works/ha-dashboards/blob/master/LICENSE');
		expect(resolve('images/home.txt').href).toBe(
			'https://github.com/raine-works/ha-dashboards/blob/master/docs/images/home.txt',
		);
		// A file in the docs folder that isn't a page (a name the docs tree doesn't allow) is GitHub's too.
		expect(resolve('Notes_1.md').href).toBe('https://github.com/raine-works/ha-dashboards/blob/master/docs/Notes_1.md');
	});

	test('to a heading on the page stay as they are, and external ones open elsewhere', () => {
		expect(resolve('#options')).toEqual({ href: '#options', external: false });
		expect(resolve('https://hacs.xyz')).toEqual({ href: 'https://hacs.xyz', external: true });
		expect(resolve('mailto:a@b.dev')).toEqual({ href: 'mailto:a@b.dev', external: false });
	});

	test('are rewritten in the rendered page, external ones opening in a new tab', () => {
		const { html } = renderDocsPage(
			'ha-dashboards',
			'reference/modules',
			'# Modules\n\nSee [options](options.md), [the rules](../../AGENTS.md#rules), [HACS](https://hacs.xyz) and [below](#x).\n\n## X\n',
		);
		expect(html).toContain('<a href="/projects/ha-dashboards/docs/reference/options">options</a>');
		expect(html).toContain(
			'<a href="https://github.com/raine-works/ha-dashboards/blob/master/AGENTS.md#rules" target="_blank" rel="noopener noreferrer">the rules</a>',
		);
		expect(html).toContain('<a href="https://hacs.xyz" target="_blank" rel="noopener noreferrer">HACS</a>');
		expect(html).toContain('<a href="#x">below</a>');
	});
});

describe('a docs page’s images', () => {
	const render = (markdown: string, page = 'cards') => renderDocsPage('ha-dashboards', page, markdown).html;

	test('beside the page are GitHub’s raw files, lazy, with their alt text', () => {
		expect(render('![The home dashboard](images/home-light.png)')).toContain(
			'<img src="https://raw.githubusercontent.com/raine-works/ha-dashboards/master/docs/images/home-light.png" alt="The home dashboard" loading="lazy" decoding="async" />',
		);
	});

	test('are resolved from the page they’re in', () => {
		expect(render('![x](../images/a.png)', 'reference/modules')).toContain(
			'raine-works/ha-dashboards/master/docs/images/a.png"',
		);
		expect(render('![x](/docs/b.png)')).toContain('raine-works/ha-dashboards/master/docs/b.png"');
	});

	test('on the web are kept only over https; any other is its alt text', () => {
		expect(render('![x](https://example.com/a.png)')).toContain(
			'<img src="https://example.com/a.png" alt="x" loading="lazy"',
		);
		const insecure = render('![Plain http](http://example.com/a.png)');
		expect(insecure).not.toContain('<img');
		expect(insecure).toContain('Plain http');
		expect(render('![x](data:image/png;base64,AAAA)')).not.toContain('<img');
	});
});

describe('a docs page’s Markdown', () => {
	test('loses its HTML comments, but not those in code', () => {
		const text = stripHtmlComments(
			'<!-- Written by a script -->\n\n# T\n\nA <!-- inline --> b\n\n```html\n<!-- keep -->\n```\n',
		);
		expect(text).not.toContain('Written by a script');
		expect(text).not.toContain('inline');
		expect(text).toContain('<!-- keep -->');
	});

	test('is never raw HTML: it’s shown as text', () => {
		const { html } = renderDocsPage(
			'ha-dashboards',
			undefined,
			'# T\n\n<script>alert(1)</script>\n\nHi <b onclick="x">there</b> [x](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n',
		);
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<b ');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('javascript:');
	});

	test('takes its title from its first heading, leaving it out of the body', () => {
		const page = renderDocsPage(
			'ha-dashboards',
			'installation',
			'<!-- x -->\n\n# The `integration` guide\n\nText.\n\n## Step\n',
		);
		expect(page.title).toBe('The integration guide');
		expect(page.html).not.toContain('<h1');
		expect(page.headings).toEqual([{ level: 2, id: 'step', text: 'Step' }]);
		expect(splitTitle('Text first\n\n# Later').title).toBeNull();
		expect(renderDocsPage('ha-dashboards', 'reference/modules', 'No heading.').title).toBe('Modules');
	});

	test('colours YAML, JSON and shell, and has tables that scroll', () => {
		const { html } = renderDocsPage(
			'ha-dashboards',
			undefined,
			'# T\n\n```yaml\nviews:\n  - title: Home\n```\n\n```json\n{"a": 1}\n```\n\n```bash\nbun test\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |\n',
		);
		expect(html).toContain('<div class="code-label">YAML</div>');
		expect(html).toContain('hljs-attr');
		expect(html).toContain('<div class="code-label">JSON</div>');
		expect(html).toContain('<div class="code-label">Shell</div>');
		expect(html).toContain('<div class="table-scroll">');
	});
});

describe('the navigation', () => {
	const index = `# Docs

| Guide | |
| :--- | :--- |
| [Installation](installation.md) | First steps |
| [The cards](cards.md) | Options |

| Reference (written from the code) | |
| :--- | :--- |
| [Modules](reference/modules.md) | Every feature |
| [Repo](../AGENTS.md) | Not a docs page |
| [Again](installation.md) | Listed once |

\`\`\`md
| Fenced | |
| - | - |
| [Hidden](hidden.md) | |
\`\`\`
`;

	test('is the pages the index links to, in its order, with their tables', () => {
		expect(docsNav('ha-dashboards', index)).toEqual([
			{ title: 'Installation', page: 'installation', group: 'Guide' },
			{ title: 'The cards', page: 'cards', group: 'Guide' },
			{ title: 'Modules', page: 'reference/modules', group: 'Reference' },
		]);
	});
});
