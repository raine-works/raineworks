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
	/** Its logo, a square image in the repository (a path from its root), shown beside the title. */
	logo?: string;
	/** Screenshots in the repository (paths from its root), shown on the page in this order. */
	screenshots?: { path: string; alt: string }[];
	/** A Home Assistant integration: the page offers to open it in the Home Assistant Marketplace. */
	homeAssistant?: true;
	/** For another company’s product: who it isn’t affiliated with, shown on its page. */
	disclaimer?: string;
}

/** Whose repositories. */
export const PROJECTS_OWNER = 'raine-works';

/** A file of a project's repository as GitHub serves it, from its default branch's latest commit. */
export function repoFileUrl(project: ProjectEntry, path: string): string {
	return `https://raw.githubusercontent.com/${PROJECTS_OWNER}/${project.repo}/HEAD/${path}`;
}

/** My Home Assistant's link that opens the project's repository in the Home Assistant Marketplace (2026.11+). */
export function marketplaceUrl(project: ProjectEntry): string {
	const query = new URLSearchParams({ owner: PROJECTS_OWNER, repository: project.repo, category: 'integration' });
	return `https://my.home-assistant.io/redirect/marketplace_repository/?${query}`;
}

const brandIcon = (domain: string) => `custom_components/${domain}/brand/icon@2x.png`;

/** In the order the pages link on to each other. */
export const projects: ProjectEntry[] = [
	{
		repo: 'ha-dashboards',
		slug: 'ha-dashboards',
		title: 'Raineworks Dashboards',
		summary:
			'Home Assistant dashboards for desktops, phones and wall tablets, built with Preact, shadcn/ui and Tailwind, with an integration that serves them.',
		logo: brandIcon('raineworks_dashboards'),
		screenshots: [
			{ path: 'docs/images/home-dark.png', alt: 'The Home dashboard on a desktop, in the Raineworks theme' },
			{ path: 'docs/images/wall-panel.png', alt: 'The wall panel card on a 10.5-inch tablet' },
			{ path: 'docs/images/phone.png', alt: 'The Home dashboard on a phone' },
			{ path: 'docs/images/home-light.png', alt: 'The Home dashboard in light mode' },
		],
		homeAssistant: true,
	},
	{
		repo: 'ha-googletv',
		slug: 'ha-googletv',
		title: 'Raineworks TV',
		summary:
			'A Home Assistant integration with a TV app of its own for Google TV and Android TV: control, notifications, live cameras, media and dashboards.',
		// The TV app’s icon, Raineworks TV’s own (the integration’s icon in Home Assistant is Google TV’s)
		logo: 'android/play/icon-512.png',
		disclaimer:
			'Not affiliated with, authorized or endorsed by Google. Google TV and Android TV are trademarks of Google LLC.',
		screenshots: [
			{
				path: 'docs/images/3-notification-buttons.png',
				alt: 'A doorbell pop-up over the TV app, answered with the remote: Unlock or Ignore',
			},
			{ path: 'docs/images/0a-home.png', alt: 'The TV app’s home screen: connected to Home Assistant, over ADB' },
			{ path: 'docs/images/5-song.png', alt: 'Music from Home Assistant playing on the TV' },
			{ path: 'docs/images/6-dashboard.png', alt: 'A Home Assistant dashboard cast to the TV' },
		],
		homeAssistant: true,
	},
	{
		repo: 'ha-grok',
		slug: 'ha-grok',
		title: 'xAI Grok for Home Assistant',
		summary:
			'An unofficial Home Assistant integration for xAI’s Grok, built for a fast voice assistant: conversation, speech to text and text to speech, all streaming.',
		logo: brandIcon('xai_grok'),
		disclaimer:
			'Not affiliated with, authorized or endorsed by xAI. Grok and its logo are xAI’s. It uses xAI’s API with your own key.',
		homeAssistant: true,
	},
	{
		repo: 'ha-music-assistant',
		slug: 'ha-music-assistant',
		title: 'Music Assistant for Home Assistant',
		summary:
			'Home Assistant’s Music Assistant integration with the whole queue and its edits, podcast episodes and the Party link, replacing the built-in one in place.',
		logo: brandIcon('music_assistant'),
		disclaimer:
			'Not affiliated with, authorized or endorsed by the Music Assistant project or the Open Home Foundation. Music Assistant’s name and logo are its project’s.',
		homeAssistant: true,
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
		logo: brandIcon('everscent'),
		disclaimer: 'Not affiliated with, authorized or endorsed by EverScent. EverScent’s name and logo are its own.',
		homeAssistant: true,
	},
	{
		repo: 'ha-warden',
		slug: 'ha-warden',
		title: 'Warden for Home Assistant',
		summary:
			'Groups, fine-grained permissions and required two-factor authentication for Home Assistant users, enforced by Home Assistant’s own permission engine.',
		logo: brandIcon('warden'),
		homeAssistant: true,
	},
	{
		repo: 'ha-gitops',
		slug: 'ha-gitops',
		title: 'GitOps for Home Assistant',
		summary:
			'Keep your Home Assistant configuration in Git and deploy it by pushing: a configuration check first, a rollback when it fails, and a reload of what changed.',
		logo: brandIcon('gitops'),
		homeAssistant: true,
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
