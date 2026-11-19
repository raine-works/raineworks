/**
 * Raine's projects, from GitHub, for `GET /api/projects`: every public repository under `raine-works` tagged with the
 * topic {@link PROJECT_TOPIC} (forks and archived ones aside), with its description, what it's built with (its
 * language, then its other topics), its stars, and whether it's featured on the home page ({@link FEATURED_TOPIC}).
 * Tagging a repository on GitHub is how it joins the site; no list is kept here.
 *
 * One request to GitHub's REST API answers for every repository, kept for {@link PROJECTS_TTL_MS}, so the anonymous
 * rate limit (60 an hour) is never near. When GitHub doesn't answer, the last list it gave is served; with none,
 * `null`, and it isn't asked again for {@link RETRY_MS}.
 *
 * @module lib/github
 */

import { tryCatch } from '@raineworks/tools/prototypes';
import { z } from 'zod';

/** Whose repositories. */
export const GITHUB_OWNER = 'raine-works';
/** The topic that lists a repository on the site. */
export const PROJECT_TOPIC = 'raineworks';
/** The topic that also features it on the home page. */
export const FEATURED_TOPIC = 'raineworks-featured';
/** How long the list is kept before GitHub is asked again. */
export const PROJECTS_TTL_MS = 10 * 60_000;
/** How long, with no list at all, before a failed request is tried again. */
export const RETRY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

const reposSchema = z.array(
	z.object({
		name: z.string(),
		description: z.string().nullable().catch(null),
		html_url: z.url(),
		language: z.string().nullable().catch(null),
		topics: z.array(z.string()).catch([]),
		stargazers_count: z.number().int().min(0),
		fork: z.boolean().catch(false),
		archived: z.boolean().catch(false),
	}),
);

/** A project, as its card shows it. */
export const projectSchema = z.object({
	name: z.string().meta({ description: 'The repository’s name on GitHub.', examples: ['ha-grok'] }),
	description: z.string().meta({
		description: 'What it is: the repository’s description, empty when it has none.',
		examples: ['Home Assistant integration for xAI Grok'],
	}),
	href: z.url().meta({ description: 'The repository.', examples: ['https://github.com/raine-works/ha-grok'] }),
	stack: z.array(z.string()).meta({
		description: 'What it’s built with: its main language, then its topics.',
		examples: [['Python', 'home-assistant', 'hacs']],
	}),
	stars: z
		.number()
		.int()
		.min(0)
		.meta({ description: 'Its stars on GitHub.', examples: [12] }),
	featured: z.boolean().meta({ description: 'Shown on the home page.', examples: [true] }),
});

export type Project = z.infer<typeof projectSchema>;

/** The projects, by name (a leading dot aside), and when GitHub said so. */
export interface Projects {
	projects: Project[];
	fetchedAt: string;
}

const sortName = (name: string) => name.replace(/^\./, '');

/** The tagged repositories as projects: forks and archived ones left out, the marker topics off the stack. */
export function toProjects(repos: z.infer<typeof reposSchema>): Project[] {
	return repos
		.filter((repo) => repo.topics.includes(PROJECT_TOPIC) && !repo.fork && !repo.archived)
		.map((repo) => {
			const topics = repo.topics.filter((topic) => topic !== PROJECT_TOPIC && topic !== FEATURED_TOPIC);
			const language = repo.language ? [repo.language] : [];
			return {
				name: repo.name,
				description: repo.description?.trim() ?? '',
				href: repo.html_url,
				stack: [...language, ...topics.filter((topic) => topic !== repo.language?.toLowerCase())],
				stars: repo.stargazers_count,
				featured: repo.topics.includes(FEATURED_TOPIC),
			};
		})
		.sort((a, b) => sortName(a.name).localeCompare(sortName(b.name)));
}

let cached: { value: Projects | null; until: number } | null = null;
let inFlight: Promise<Projects | null> | null = null;

/** Forgets what GitHub said: for tests. */
export function resetProjects(): void {
	cached = null;
	inFlight = null;
}

async function fetchProjects(fetchImpl: typeof fetch): Promise<Projects | null> {
	const { data: repos, error } = await tryCatch(async () => {
		const response = await fetchImpl(`https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&type=owner`, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': 'raineworks.com',
				'X-GitHub-Api-Version': '2022-11-28',
			},
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
		return reposSchema.parse(await response.json());
	});
	if (error) {
		console.warn(`GitHub’s repositories are unavailable: ${error.message}`);
		const stale = cached?.value ?? null;
		cached = { value: stale, until: Date.now() + (stale ? PROJECTS_TTL_MS : RETRY_MS) };
		return stale;
	}
	const value = { projects: toProjects(repos), fetchedAt: new Date().toISOString() };
	cached = { value, until: Date.now() + PROJECTS_TTL_MS };
	return value;
}

/** The projects, from GitHub at most once per {@link PROJECTS_TTL_MS}; requests that arrive meanwhile share one fetch. */
export function projects(fetchImpl: typeof fetch = fetch): Promise<Projects | null> {
	if (cached && Date.now() < cached.until) return Promise.resolve(cached.value);
	inFlight ??= fetchProjects(fetchImpl).finally(() => {
		inFlight = null;
	});
	return inFlight;
}
