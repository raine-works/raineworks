/**
 * What the site says: Raine's profile, work, education, projects and hobbies. Sourced from Raine's public LinkedIn
 * (linkedin.com/in/rainepetersen), public listings and the pinned repositories on github.com/raine-works. The SSH
 * app (`@raineworks/ssh`) renders the same content. Copy still marked `TODO(raine)` is left off the pages (`isWritten`).
 *
 * @module content/profile
 */

export interface WorkEntry {
	role: string;
	org: string;
	period: string;
	summary: string;
	/** The company's site. */
	href: string;
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
	href: string;
	/** Shown on the home page. */
	featured?: boolean;
	/** This site: marked as the one you're looking at. */
	here?: boolean;
}

export interface HobbyEntry {
	name: string;
	note: string;
}

/** Copy still to be written (`TODO(raine): …`) is kept out of the page; this says whether `text` is real. */
export function isWritten(text: string): boolean {
	return !text.startsWith('TODO(');
}

export const profile = {
	name: 'Raine Petersen',
	title: 'Co-founder & Chief Systems Architect @ bndl + Lux Financial',
	location: 'Salem, Utah',
	tagline: 'Driven, responsible, and quick to learn — co-founder building the systems behind bndl and Lux Financial.',
	bio: "I'm a co-founder and Chief Systems Architect at bndl and Lux Financial, where I lead the architecture behind both. I like software that is fast, simple to operate, and tied to a real business goal, like SaaS that takes work off a company's plate. Off the clock I run a homelab, tinker with hardware, and publish what I build as open source.",
	contact: {
		email: 'hello@raineworks.com',
		github: 'https://github.com/raine-works',
		linkedin: 'https://www.linkedin.com/in/rainepetersen',
		coffee: 'https://buymeacoffee.com/raineworks',
	},
};

export const work: WorkEntry[] = [
	{
		role: 'Co-founder & Chief Systems Architect',
		org: 'bndl',
		href: 'https://bndl.co',
		period: 'Apr 2024 — present',
		summary:
			'I drive the design and development of our software stack and help shape the technical vision and strategy. I oversee the architecture and implementation of multiple projects, keeping them scalable, high-performing, and aligned with business goals, with a focus on SaaS products that streamline business operations. Lehi, Utah.',
	},
	{
		role: 'Co-founder & Chief Systems Architect',
		org: 'Lux Financial',
		href: 'https://luxfinancial.io',
		period: 'Aug 2022 — present',
		summary:
			'I lead the creation and evolution of our proprietary software platform, owning architecture and development across projects so they meet demands of scale and performance. The work is software built for the unique financial landscape of the solar industry. Lehi, Utah.',
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
		name: 'ha-everscent',
		description:
			'An unofficial Home Assistant integration for EverScent whole-home HVAC scent diffusers: power, schedules, fragrance level and status, over the same cloud API the mobile app uses.',
		stack: ['Python', 'Home Assistant', 'HACS'],
		href: 'https://github.com/raine-works/ha-everscent',
		featured: true,
	},
	{
		name: 'ha-grok',
		description:
			'An unofficial Home Assistant integration for xAI Grok, built for a fast voice assistant: speech to text, conversation and text to speech all stream end to end.',
		stack: ['Python', 'Home Assistant', 'HACS', 'xAI'],
		href: 'https://github.com/raine-works/ha-grok',
		featured: true,
	},
	{
		name: 'raineworks',
		description:
			'This site. A Bun workspace monorepo: a Hono backend that compiles to a single binary with every micro-frontend embedded, serving a React 19 front end built on shadcn/ui and ui-sdk.',
		stack: ['Bun', 'React 19', 'TypeScript', 'Hono', 'Tailwind v4', 'shadcn/ui', 'ui-sdk', 'Docker'],
		href: 'https://github.com/raine-works/raineworks',
		here: true,
	},
	{
		name: 'sendspin-a1s-source',
		description:
			'ESPHome firmware that turns an ESP32-A1S audio kit into an encrypted line-in source for Music Assistant, streaming turntables and other analog gear to synchronized multi-room speakers.',
		stack: ['C++', 'ESPHome', 'ESP-IDF', 'Noise Protocol', 'Opus'],
		href: 'https://github.com/raine-works/sendspin-a1s-source',
		featured: true,
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
