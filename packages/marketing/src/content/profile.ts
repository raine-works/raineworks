/**
 * Sourced from Raine's public LinkedIn (linkedin.com/in/rainepetersen) and public listings.
 * Anything still marked TODO(raine) couldn't be verified and needs real copy.
 */

export interface WorkEntry {
	role: string;
	org: string;
	period: string;
	summary: string;
}

export interface EducationEntry {
	school: string;
	period: string;
	focus: string;
}

export interface ProjectEntry {
	name: string;
	description: string;
	stack: string[];
	href?: string;
}

export interface HobbyEntry {
	name: string;
	note: string;
}

export const profile = {
	name: 'Raine Petersen',
	title: 'Co-founder & Chief Systems Architect @ bndl + Lux Financial',
	location: 'Salem, Utah',
	tagline: 'Driven, responsible, and quick to learn — co-founder building the systems behind bndl and Lux Financial.',
	bio: 'TODO(raine): a few sentences about your professional background — what you architect at bndl and Lux Financial and what you care about.',
	contact: {
		email: 'TODO@example.com',
		github: 'https://github.com/raine-works',
		linkedin: 'https://www.linkedin.com/in/rainepetersen',
		buyMeACoffee: 'https://buymeacoffee.com/raineworks',
	},
};

export const work: WorkEntry[] = [
	{
		role: 'Co-founder & Chief Systems Architect',
		org: 'bndl',
		period: 'TODO(raine): 20XX — present',
		summary: 'TODO(raine): what you own and build at bndl. Based in Lehi, Utah.',
	},
	{
		role: 'Co-founder & Chief Systems Architect',
		org: 'Lux Financial',
		period: 'TODO(raine): 20XX — present',
		summary: 'TODO(raine): what you did there.',
	},
];

export const education: EducationEntry[] = [
	{
		school: 'Snow College',
		period: '2011 — 2015',
		focus: 'General education, design and information technology',
	},
];

export const projects: ProjectEntry[] = [
	{
		name: 'devcontainer-features',
		description: 'Dev container features for installing Bun and Deno.',
		stack: ['Shell', 'Dev Containers'],
		href: 'https://github.com/raine-works/devcontainer-features',
	},
	{
		name: '.dotfiles',
		description:
			'My macOS development environment, managed with GNU Stow. One command sets up a new machine: Ghostty, Starship, shell tooling, and editor config.',
		stack: ['Shell', 'GNU Stow', 'macOS'],
		href: 'https://github.com/raine-works/.dotfiles',
	},
	{
		name: 'rainestack',
		description:
			'A production-ready full-stack TypeScript monorepo starter: contract-first oRPC APIs with generated OpenAPI, Postgres + Prisma with an automatic audit trail, and real-time updates over LISTEN/NOTIFY.',
		stack: ['Bun', 'Turborepo', 'React 19', 'Prisma', 'PostgreSQL', 'oRPC'],
		href: 'https://github.com/raine-works/rainestack',
	},
	{
		name: 'raineworks',
		description:
			'This site. A Bun workspace monorepo: a Hono backend that compiles to a single binary with every micro-frontend embedded, serving a React 19 terminal-themed front end.',
		stack: ['Bun', 'React 19', 'TypeScript', 'Hono', 'Tailwind v4', 'Docker'],
		href: undefined,
	},
	{
		name: 'sendspin-a1s-source',
		description:
			'ESPHome firmware that turns an ESP32-A1S audio kit into an encrypted line-in source for Music Assistant, streaming turntables and other analog gear to synchronized multi-room speakers.',
		stack: ['C++', 'ESPHome', 'ESP-IDF', 'Noise Protocol', 'Opus'],
		href: 'https://github.com/raine-works/sendspin-a1s-source',
	},
	{
		name: 'turbo-cache',
		description:
			'A self-hosted Turborepo remote cache server, shipped as a Docker image, so a whole team can share one build cache.',
		stack: ['TypeScript', 'Docker', 'Turborepo'],
		href: 'https://github.com/raine-works/turbo-cache',
	},
];

export const hobbies: HobbyEntry[] = [
	{
		name: 'Homelab',
		note: 'Self-hosting on my own hardware — servers, networking, and containers. Always something new running on the rack.',
	},
	{
		name: 'Software development',
		note: 'Writing code for fun as much as for work. Side projects are where I try the new tools first.',
	},
	{
		name: 'Tinkering',
		note: 'Taking things apart to see how they work, and occasionally getting them back together.',
	},
	{
		name: 'Video games',
		note: 'Winding down with a controller, and appreciating the engineering behind a well-built game.',
	},
	{
		name: 'Golf',
		note: 'Time outside on the course, chasing a better round.',
	},
	{
		name: 'Motorcycles',
		note: 'Nothing beats an open road on two wheels.',
	},
	{
		name: 'Cars',
		note: 'I just enjoy driving — a good car and a good road.',
	},
];
