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
		github: 'https://github.com/TODO',
		linkedin: 'https://www.linkedin.com/in/rainepetersen',
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
	{
		role: 'TODO(raine): role',
		org: 'Solcius',
		period: 'TODO(raine): 20XX — 20XX',
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
		name: 'raineworks',
		description:
			'This site. A Bun workspace monorepo: a Hono backend that compiles to a single binary with every micro-frontend embedded, serving a React 19 terminal-themed front end.',
		stack: ['Bun', 'React 19', 'TypeScript', 'Hono', 'Tailwind v4', 'Docker'],
		href: undefined,
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
		note: 'Riding, and working on the bikes as much as riding them.',
	},
	{
		name: 'Cars',
		note: 'Anything with an engine worth talking about — driving, wrenching, and following the scene.',
	},
];
