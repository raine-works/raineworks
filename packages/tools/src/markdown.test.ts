import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type MarkdownCollection,
	markdownPlugin,
	renderDoc,
	type RenderedDoc,
	splitFrontmatter,
} from '@raineworks/tools/markdown';
import '@raineworks/tools/prototypes';
import { RELEASE_NOTES_DIR } from '@raineworks/tools/version';

describe('guides', () => {
	test('frontmatter, heading ids and the page’s headings', () => {
		const guide = renderDoc(
			'keys',
			'---\ntitle: API keys\ndescription: Make one.\norder: 2\n---\n## Making a key\n\nText.\n\n### Scopes `org:read`\n',
		);
		expect(guide).toMatchObject({ slug: 'keys', title: 'API keys', description: 'Make one.', order: 2 });
		expect(guide.headings).toEqual([
			{ level: 2, id: 'making-a-key', text: 'Making a key' },
			{ level: 3, id: expect.any(String), text: 'Scopes org:read' },
		]);
		expect(guide.html).toContain('<h2 id="making-a-key">');
	});

	test('raw HTML is refused, and tables scroll on their own', () => {
		const guide = renderDoc(
			'x',
			'<script>alert(1)</script>\n\nHi <b onclick="x">there</b>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
		);
		expect(guide.html).not.toContain('<script>');
		expect(guide.html).not.toContain('<b onclick');
		expect(guide.html).toContain('<div class="table-scroll"><table>');
	});

	test('code blocks are coloured at build time, still escaped', () => {
		const guide = renderDoc('x', '```bash\ncurl "https://x" -H "a: <b>"\n```\n');
		expect(guide.html).toContain('<code class="hljs language-bash">');
		expect(guide.html).toContain('hljs-string');
		expect(guide.html).toContain('&lt;b&gt;');
		expect(guide.html).not.toContain('<b>');
	});

	test('every code block has its bar, labelled with its language or as text', () => {
		const guide = renderDoc(
			'x',
			'```json\n{}\n```\n\n```\nplain <b>\n```\n\n1. Step\n\n   ```bash\n   echo hi\n   ```\n',
		);
		expect(guide.html.match(/<div class="code-block">/g)).toHaveLength(3);
		expect(guide.html).toContain('<div class="code-label">JSON</div>');
		expect(guide.html).toContain('<div class="code-label">Text</div>');
		expect(guide.html).toContain('plain &lt;b&gt;');
		expect(guide.html).not.toMatch(/<pre><code>/);
	});

	test('a link or image to a scheme other than http, https or mailto goes nowhere, however it is spelled', () => {
		for (const markdown of [
			'[a](javascript:alert(1))',
			'![i](javascript:alert(1))',
			'[a](JavaScript:alert(1))',
			'[a]( javascript:alert(1))',
			'[a](<java\tscript:alert(1)>)',
			'[a](&#106;avascript:alert(1))',
			'[a](&#x6A;avascript&colon;alert(1))',
			'[a](java&#x09;script:alert(1))',
			'[a](<java&#0;script:alert(1)>)',
			'[a](<\u0001javascript:alert(1)>)',
			'[a](vbscript:x)',
			'![i](data:image/svg+xml,x)',
		]) {
			const html = renderDoc('x', markdown).html;
			// Where a browser on the page would go: never anywhere but this site (`#`, or a relative path the renderer
			// percent-encoded the tab into).
			const urls = [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map(
				(match) => new URL((match[1] ?? '').replace(/&amp;/g, '&'), 'https://site.test/guides/').href,
			);
			expect({ markdown, urls }).toEqual({ markdown, urls: [expect.stringMatching(/^https:\/\/site\.test\//)] });
		}
		expect(renderDoc('x', '[a](javascript:alert(1)) ![i](javascript:alert(1))').html).toBe(
			'<p><a href="#">a</a> <img src="#" alt="i" /></p>\n',
		);
	});

	test('links to the web, mail and this site are kept', () => {
		const html = renderDoc(
			'x',
			'[a](https://x.dev/?a=1&b=2) [b](HTTP://x.dev) [c](mailto:a@b.dev) [d](/guides) [e](#top) [f](rel/x?y=javascript:z) ![g](/i.png)',
		).html;
		for (const url of [
			'https://x.dev/?a=1&amp;b=2',
			'HTTP://x.dev',
			'mailto:a@b.dev',
			'/guides',
			'#top',
			'rel/x?y=javascript:z',
		]) {
			expect(html).toContain(`href="${url}"`);
		}
		expect(html).toContain('src="/i.png"');
	});

	test('<https://…> autolinks are links, bare URLs too, but not inside code', () => {
		const html = renderDoc(
			'x',
			'See <https://x.dev/a?b=1&c=2>, <mailto:a@b.dev> and https://y.dev.\n\n`<https://z.dev>`\n\n```\n<https://w.dev>\n```\n',
		).html;
		expect(html).toContain('<a href="https://x.dev/a?b=1&amp;c=2">https://x.dev/a?b=1&amp;c=2</a>');
		expect(html).toContain('<a href="mailto:a@b.dev">mailto:a@b.dev</a>');
		expect(html).toContain('<a href="https://y.dev">');
		expect(html).toContain('<code>&lt;https://z.dev&gt;</code>');
		expect(html).toContain('&lt;https://w.dev&gt;');
		expect(html).not.toContain('href="https://z.dev"');
		expect(html).not.toContain('href="https://w.dev"');
	});

	test('a language named like an Object property is labelled with its own name', () => {
		const html = renderDoc('x', '```constructor\na\n```\n\n```__proto__\nb\n```\n').html;
		expect(html).toContain('<div class="code-label">constructor</div>');
		expect(html).toContain('<div class="code-label">__proto__</div>');
	});

	test("::: for <zones> scopes a part to those zones; the rest is everyone's", () => {
		const note = renderDoc(
			'2026.11.1',
			'---\ntitle: T\n---\n## For everyone\n\n::: for app, admin\n## Settings\n:::\n\n::: for admin\nThe queues.\n:::\n',
		);
		expect(note.sections.map((section) => section.zones)).toEqual([null, ['app', 'admin'], ['admin']]);
		expect(note.sections[1]?.html).toContain('Settings');
		expect(note.zones).toBeNull();
		const scoped = renderDoc('x', '::: for admin\nOnly theirs.\n:::\n');
		expect(scoped.zones).toEqual(['admin']);
		expect(renderDoc('y', 'Plain.').sections).toEqual([{ zones: null, html: expect.stringContaining('Plain.') }]);
	});

	test('a marker indented under a list still opens and closes its part, and never shows as text', () => {
		const note = renderDoc(
			'2026.11.2',
			'## Everywhere\n\n- One.\n\n  ::: for admin\n## Admin\n\n- Queues.\n  :::\n\nFor everyone again.\n',
		);
		expect(note.sections.map((section) => section.zones)).toEqual([null, ['admin'], null]);
		expect(note.sections.map((section) => section.html).join('')).not.toContain(':::');
		// What follows the closing marker is everyone's again, not left inside the part.
		expect(note.sections[2]?.html).toContain('For everyone again.');
		expect(note.sections[1]?.html).not.toContain('For everyone again.');
	});

	test('no release note of the project’s shows a marker as text', () => {
		const notes = readdirSync(RELEASE_NOTES_DIR).filter((file) => file.endsWith('.md'));
		expect(notes.isEmpty()).toBe(false);
		for (const file of notes) {
			const note = renderDoc(file, readFileSync(join(RELEASE_NOTES_DIR, file), 'utf8'));
			expect(note.sections.map((section) => section.html).join('')).not.toContain(':::');
		}
	});

	test('no frontmatter is no metadata', () => {
		expect(splitFrontmatter('## Hi')).toEqual({ meta: {}, body: '## Hi' });
	});

	test("GitHub's alerts become callouts, titled by their kind", () => {
		const doc = renderDoc('x', '> [!WARNING]\n> Mind the gap.\n\n> Just a quote.\n');
		expect(doc.html).toContain('<aside class="callout callout-warning" role="note">');
		expect(doc.html).toContain('<p class="callout-title">Warning</p>');
		expect(doc.html).toContain('Mind the gap.');
		expect(doc.html).toContain('<blockquote>');
	});
});

describe('markdownPlugin', () => {
	const dir = mkdtempSync(join(tmpdir(), 'raineworks-markdown-'));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	/**
	 * Bundles an entry that imports collections (and a document) through the plugin, and returns what it exports, as
	 * JSON: the bundle runs in its own process, so it isn't counted as this package's code.
	 */
	async function bundle(collections: MarkdownCollection[], source: string) {
		const entry = join(dir, `entry-${Bun.randomUUIDv7()}.ts`);
		await Bun.write(entry, source);
		const outdir = join(dir, `out-${Bun.randomUUIDv7()}`);
		const result = await Bun.build({
			entrypoints: [entry],
			outdir,
			target: 'bun',
			plugins: [markdownPlugin(collections)],
		});
		expect(result.success).toBe(true);
		const output = result.outputs.find((file) => file.kind === 'entry-point')?.path ?? '';
		const run = Bun.spawnSync([
			process.execPath,
			'--eval',
			`const m = await import(${JSON.stringify(output)}); console.log(JSON.stringify({ ...m, loaded: await m.loaded() }));`,
		]);
		expect(run.stderr.toString()).toBe('');
		return JSON.parse(run.stdout.toString()) as Record<string, unknown>;
	}

	test('a document imports as rendered, and each collection lists its directory in its order', async () => {
		const docs = join(dir, 'docs');
		mkdirSync(docs);
		writeFileSync(join(docs, 'b.md'), '---\ntitle: Beta\norder: 1\ndate: 2026-01-02\n---\n## B\n');
		writeFileSync(join(docs, 'a.md'), '---\ntitle: Alpha\norder: 2\ndate: 2026-03-01\n---\n## A\n');
		writeFileSync(join(docs, 'c.md'), '---\ntitle: Gamma\norder: 2\ndate: 2026-03-01\n---\n## C\n');
		writeFileSync(join(docs, 'notes.txt'), 'not a document');
		const notes = join(dir, 'notes');
		mkdirSync(notes);
		writeFileSync(join(notes, '2026.9.1.md'), 'Old.');
		writeFileSync(join(notes, '2026.11.1.md'), 'New.');
		const exports = await bundle(
			[
				{ module: 'raineworks:by-order', dir: docs, sort: 'order' },
				{ module: 'raineworks:by-date', dir: docs, sort: 'newest' },
				{ module: 'raineworks:by-version', dir: notes, sort: 'version' },
				{ module: 'raineworks:none', dir: join(dir, 'missing'), sort: 'order' },
			],
			`import doc from ${JSON.stringify(join(docs, 'a.md'))};
export { doc };
export { docs as byOrder } from 'raineworks:by-order';
export { docs as byDate } from 'raineworks:by-date';
export { docs as byVersion } from 'raineworks:by-version';
export { docs as none } from 'raineworks:none';
import { docs } from 'raineworks:by-order';
export const loaded = async () => (await docs[0].load()).default.title;
`,
		);
		const slugs = (name: string) => (exports[name] as Array<{ slug: string }>).map(({ slug }) => slug);
		expect((exports.doc as RenderedDoc).title).toBe('Alpha');
		expect((exports.doc as RenderedDoc).headings).toEqual([{ id: 'a', text: 'A', level: 2 }]);
		expect(slugs('byOrder')).toEqual(['b', 'a', 'c']);
		expect(slugs('byDate')).toEqual(['c', 'a', 'b']);
		expect(slugs('byVersion')).toEqual(['2026.11.1', '2026.9.1']);
		expect(slugs('none')).toEqual([]);
		expect(exports.loaded).toBe('Beta');
	});
});
