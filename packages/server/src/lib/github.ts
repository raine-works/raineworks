/**
 * Star counts of the public repositories under `raine-works` on GitHub, for `GET /api/projects/stars`. One request to
 * GitHub's REST API answers for every repository, kept for {@link STARS_TTL_MS}, so the anonymous rate limit (60 an
 * hour) is never near. When GitHub doesn't answer, the last counts it gave are served; with none, `null`, and it isn't
 * asked again for {@link RETRY_MS}.
 *
 * @module lib/github
 */

import { tryCatch } from '@raineworks/tools/prototypes';
import { z } from 'zod';

/** Whose repositories. */
export const GITHUB_OWNER = 'raine-works';
/** How long counts are kept before GitHub is asked again. */
export const STARS_TTL_MS = 10 * 60_000;
/** How long, with no counts at all, before a failed request is tried again. */
export const RETRY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

const reposSchema = z.array(z.object({ name: z.string(), stargazers_count: z.number().int().min(0) }));

/** Each repository's stars, by name, and when GitHub said so. */
export interface RepoStars {
	stars: Record<string, number>;
	fetchedAt: string;
}

let cached: { value: RepoStars | null; until: number } | null = null;
let inFlight: Promise<RepoStars | null> | null = null;

/** Forgets what GitHub said: for tests. */
export function resetRepoStars(): void {
	cached = null;
	inFlight = null;
}

async function fetchRepoStars(fetchImpl: typeof fetch): Promise<RepoStars | null> {
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
		console.warn(`GitHub’s star counts are unavailable: ${error.message}`);
		const stale = cached?.value ?? null;
		cached = { value: stale, until: Date.now() + (stale ? STARS_TTL_MS : RETRY_MS) };
		return stale;
	}
	const value = {
		stars: Object.fromEntries(repos.map((repo) => [repo.name, repo.stargazers_count])),
		fetchedAt: new Date().toISOString(),
	};
	cached = { value, until: Date.now() + STARS_TTL_MS };
	return value;
}

/** The counts, from GitHub at most once per {@link STARS_TTL_MS}; requests that arrive meanwhile share one fetch. */
export function repoStars(fetchImpl: typeof fetch = fetch): Promise<RepoStars | null> {
	if (cached && Date.now() < cached.until) return Promise.resolve(cached.value);
	inFlight ??= fetchRepoStars(fetchImpl).finally(() => {
		inFlight = null;
	});
	return inFlight;
}
