/**
 * The projects for every session: from the site's API (`GET /api/projects`, `@raineworks/api`), the repositories
 * tagged `raineworks` on GitHub, so the terminal lists what the website does. Shared by the sessions and kept as
 * long as the server keeps them, so visitors don't each ask; when the API can't answer, the last list it gave.
 *
 * @module server/projects
 */

import { createApiClient, type Project } from '@raineworks/api';
import type { LoadProjects } from '@raineworks/ssh/app';
import '@raineworks/tools/prototypes';

/** How long a list is kept before the API is asked again (the server's own cache is as long). */
export const PROJECTS_TTL_MS = 10 * 60_000;
/** How long, with no list at all, before a failed request is tried again. */
export const RETRY_MS = 60_000;

/** A loader for every session, from the API at `apiUrl` (its `fetch` replaceable for tests). */
export function projectsLoader({
	apiUrl,
	fetch,
	now = Date.now,
}: {
	apiUrl: string;
	fetch?: typeof globalThis.fetch;
	now?: () => number;
}): LoadProjects {
	const api = createApiClient({ url: apiUrl, fetch, timeoutMs: 15_000 });
	let cached: { value: Project[] | null; until: number } | null = null;
	let inFlight: Promise<Project[] | null> | null = null;

	const load = async (): Promise<Project[] | null> => {
		const { data: response } = await api.api.projects.$get().tryCatch();
		const { data: body } = response?.ok ? await response.json().tryCatch() : { data: null };
		const value = body && 'projects' in body ? body.projects : (cached?.value ?? null);
		cached = { value, until: now() + (body || value ? PROJECTS_TTL_MS : RETRY_MS) };
		return value;
	};

	return () => {
		if (cached && now() < cached.until) return Promise.resolve(cached.value);
		inFlight ??= load().finally(() => {
			inFlight = null;
		});
		return inFlight;
	};
}
