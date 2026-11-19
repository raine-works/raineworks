import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import { projects, PROJECTS_TTL_MS, resetProjects, RETRY_MS, toProjects } from '@raineworks/server/lib/github';

/** A GitHub that answers with `respond`, counting the requests. */
function github(respond: () => Response) {
	const calls: string[] = [];
	const fetchImpl = (async (input: string | URL | Request) => {
		calls.push(String(input));
		return respond();
	}) as unknown as typeof fetch;
	return { calls, fetch: fetchImpl };
}

const repo = (name: string, more: Record<string, unknown> = {}) => ({
	name,
	description: `About ${name}.`,
	html_url: `https://github.com/raine-works/${name}`,
	language: 'Python',
	topics: ['raineworks'],
	stargazers_count: 2,
	fork: false,
	archived: false,
	...more,
});

const repos = (stars: number) => Response.json([repo('ha-grok', { stargazers_count: stars }), repo('.dotfiles')]);

afterEach(() => {
	resetProjects();
	setSystemTime();
});

describe('the projects', () => {
	test('are the repositories tagged `raineworks`, forks and archived ones aside, by name', () => {
		const list = toProjects([
			repo('zeta'),
			repo('untagged', { topics: ['home-assistant'] }),
			repo('forked', { fork: true }),
			repo('old', { archived: true }),
			repo('.dotfiles'),
			repo('alpha'),
		]);
		expect(list.map((project) => project.name)).toEqual(['alpha', '.dotfiles', 'zeta']);
	});

	test('are built with their language, then their topics, the marker topics left out', () => {
		const [project] = toProjects([
			repo('ha-grok', { topics: ['raineworks', 'home-assistant', 'raineworks-featured', 'python', 'hacs'] }),
		]);
		expect(project).toEqual({
			name: 'ha-grok',
			description: 'About ha-grok.',
			href: 'https://github.com/raine-works/ha-grok',
			stack: ['Python', 'home-assistant', 'hacs'],
			stars: 2,
			featured: true,
		});
	});

	test('have an empty description, and no language, when GitHub has none', () => {
		const [project] = toProjects([repo('bare', { description: null, language: null })]);
		expect(project).toMatchObject({ description: '', stack: [], featured: false });
	});

	test('come from one request for every repository, kept ten minutes', async () => {
		const { calls, fetch } = github(() => repos(12));
		setSystemTime(new Date('2026-11-18T12:00:00Z'));
		const [first, second] = await Promise.all([projects(fetch), projects(fetch)]);
		expect(first?.projects.map((project) => [project.name, project.stars])).toEqual([
			['.dotfiles', 2],
			['ha-grok', 12],
		]);
		expect(second).toBe(first);
		expect(calls).toEqual(['https://api.github.com/users/raine-works/repos?per_page=100&type=owner']);
		await projects(fetch);
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-18T12:00:00Z') + PROJECTS_TTL_MS + 1));
		await projects(fetch);
		expect(calls).toHaveLength(2);
	});

	test('are the last ones GitHub gave while it doesn’t answer', async () => {
		let answer = () => repos(12);
		const { fetch } = github(() => answer());
		setSystemTime(new Date('2026-11-18T12:00:00Z'));
		await projects(fetch);
		answer = () => new Response('rate limited', { status: 403 });
		setSystemTime(new Date(Date.parse('2026-11-18T12:00:00Z') + PROJECTS_TTL_MS + 1));
		expect((await projects(fetch))?.projects.find((project) => project.name === 'ha-grok')?.stars).toBe(12);
	});

	test('are none when GitHub has never answered, and it isn’t asked again for a minute', async () => {
		const { calls, fetch } = github(() => Response.json({ message: 'not a list' }));
		setSystemTime(new Date('2026-11-18T12:00:00Z'));
		expect(await projects(fetch)).toBeNull();
		expect(await projects(fetch)).toBeNull();
		expect(calls).toHaveLength(1);
		setSystemTime(new Date(Date.parse('2026-11-18T12:00:00Z') + RETRY_MS + 1));
		await projects(fetch);
		expect(calls).toHaveLength(2);
	});
});
