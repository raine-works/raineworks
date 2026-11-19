/**
 * Marketing zone (`/`): Raine Petersen's site, for anyone who finds it. Mobile-first: check every page at phone width.
 *
 * ```
 * /            home: who Raine is, what Raine is building, a few projects
 * /work        experience and education
 * /projects    every open-source project
 * /hobbies     what Raine does away from work
 * /contact     email, GitHub, LinkedIn
 * ```
 *
 * Every page but the home page loads lazily. Each says what it is in `staticData.head` (`@raineworks/ui/lib/head`):
 * its title, and its description as search results and link previews show it. They're prerendered with it
 * (`src/prerender.tsx`).
 *
 * @module router
 */

import { ZONES } from '@raineworks/tools/zones';
import type { RouterContext } from '@raineworks/ui/app/root';
import { NotFoundPage } from '@raineworks/ui/blocks/full-page';
import { RouteError } from '@raineworks/ui/blocks/route-error';
import { queryClient } from '@raineworks/ui/lib/api';
import { SITE_URL } from '@raineworks/ui/lib/brand';
import type { PageHead } from '@raineworks/ui/lib/head';
import { SiteShell } from '@raineworks/web-marketing/components/site-shell';
import { profile, work } from '@raineworks/web-marketing/content/profile';
import { HomePage } from '@raineworks/web-marketing/routes/home';
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	lazyRouteComponent,
	Outlet,
} from '@tanstack/react-router';

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: function MarketingZoneShell() {
		return (
			<SiteShell>
				<Outlet />
			</SiteShell>
		);
	},
	notFoundComponent: NotFoundPage,
});

/** Who the site is about, for search engines (schema.org). */
const homeHead: PageHead = {
	title: profile.name,
	description: profile.tagline,
	structuredData: {
		'@type': 'Person',
		name: profile.name,
		url: SITE_URL,
		jobTitle: 'Co-founder & Chief Systems Architect',
		worksFor: work.map((entry) => ({ '@type': 'Organization', name: entry.org, url: entry.href })),
		homeLocation: { '@type': 'Place', name: profile.location },
		email: `mailto:${profile.contact.email}`,
		sameAs: [profile.contact.github, profile.contact.linkedin],
	},
};

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	staticData: { head: homeHead },
	component: HomePage,
});

const workRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/work',
	staticData: {
		head: {
			title: 'Work',
			description:
				'Raine Petersen’s experience and education: co-founder and Chief Systems Architect at bndl and Lux Financial.',
		},
	},
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/work'), 'WorkPage'),
});

const projectsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/projects',
	staticData: {
		head: {
			title: 'Projects',
			description: 'What Raine Petersen builds in the open, mostly for the homelab and a better everyday workflow.',
		},
	},
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/projects'), 'ProjectsPage'),
});

const hobbiesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/hobbies',
	staticData: {
		head: {
			title: 'Hobbies',
			description: 'What Raine Petersen does away from the keyboard (and some of what happens at it).',
		},
	},
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/hobbies'), 'HobbiesPage'),
});

const contactRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/contact',
	staticData: {
		head: {
			title: 'Contact',
			description:
				'Get in touch with Raine Petersen: email, GitHub, LinkedIn, or a message sent straight from the site.',
		},
	},
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/contact'), 'ContactPage'),
});

/** The marketing zone's router, at `/`. Preloads a page's chunk on intent (hover, focus). */
export const router = createRouter({
	routeTree: rootRoute.addChildren([homeRoute, workRoute, projectsRoute, hobbiesRoute, contactRoute]),
	basepath: ZONES.marketing.basepath,
	context: { queryClient },
	defaultPreload: 'intent',
	// A page that throws shows what went wrong with Retry (Reload when it's from the build before), never TanStack's own.
	defaultErrorComponent: RouteError,
	defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
