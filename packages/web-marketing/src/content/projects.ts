/**
 * The projects that have a page of their own (`/projects/<slug>`): which repository each is, its page's address, what
 * the page calls it and its one-sentence summary. The list itself is live from GitHub (`GET /api/projects`); a
 * project listed here gets a page, linked from its card. What each page says is `content/project-pages`, loaded with
 * the page, so none of it is in the home page's script.
 *
 * @module content/projects
 */

export interface ProjectEntry {
	/** The repository's name on GitHub, as `GET /api/projects` gives it. */
	repo: string;
	/** Its page: `/projects/<slug>` (lowercase, no leading dot). */
	slug: string;
	/** What the page calls it (the product's name where it has one, else the repo name). */
	title: string;
	/** One sentence: under the title, and in search results and link previews (120 to 160 characters). */
	summary: string;
}

/** In the order the pages link on to each other. */
export const projects: ProjectEntry[] = [
	{
		repo: 'ha-googletv',
		slug: 'ha-googletv',
		title: 'Raineworks TV',
		summary:
			'A Home Assistant integration with a TV app of its own for Google TV and Android TV: control, notifications, live cameras, media and dashboards.',
	},
	{
		repo: 'ha-grok',
		slug: 'ha-grok',
		title: 'xAI Grok for Home Assistant',
		summary:
			'An unofficial Home Assistant integration for xAI’s Grok, built for a fast voice assistant: conversation, speech to text and text to speech, all streaming.',
	},
	{
		repo: 'sendspin-a1s-source',
		slug: 'sendspin-a1s-source',
		title: 'ESP32-A1S encrypted Sendspin audio source',
		summary:
			'ESPHome firmware that turns the Ai-Thinker ESP32-A1S Audio Kit into an encrypted Sendspin line-in source for Music Assistant and multi-room speaker groups.',
	},
	{
		repo: 'ha-everscent',
		slug: 'ha-everscent',
		title: 'EverScent for Home Assistant',
		summary:
			'An unofficial Home Assistant integration for EverScent whole-home HVAC scent diffusers: power, schedules, fragrance levels and quick scent bursts.',
	},
	{
		repo: 'ha-warden',
		slug: 'ha-warden',
		title: 'Warden for Home Assistant',
		summary:
			'Groups, fine-grained permissions and required two-factor authentication for Home Assistant users, enforced by Home Assistant’s own permission engine.',
	},
	{
		repo: 'raineworks',
		slug: 'raineworks',
		title: 'raineworks.com',
		summary:
			'The source of this site: a Hono server compiled to one binary, a prerendered React 19 front end, and the same content in a terminal over SSH.',
	},
	{
		repo: '.dotfiles',
		slug: 'dotfiles',
		title: '浮世 dotfiles',
		summary:
			'A shared development environment for macOS and Debian/Ubuntu, in desktop and server profiles, set up with one command and safe to run again.',
	},
	{
		repo: 'devcontainer-features',
		slug: 'devcontainer-features',
		title: 'Dev container features',
		summary:
			'Small, dependable dev container features for Bun, Deno and Node.js, with a checksum-verified Node.js install and your choice of package managers.',
	},
];

/** The page for `slug`, or `undefined`. */
export function projectBySlug(slug: string): ProjectEntry | undefined {
	return projects.find((project) => project.slug === slug);
}

/** The page for the repository `repo`, or `undefined`. */
export function projectByRepo(repo: string): ProjectEntry | undefined {
	return projects.find((project) => project.repo === repo);
}
