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
 * Every page but the home page loads lazily.
 *
 * @module router
 */

import { ZONES } from '@raineworks/tools/zones';
import type { RouterContext } from '@raineworks/ui/app/root';
import { NotFoundPage } from '@raineworks/ui/blocks/full-page';
import { RouteError } from '@raineworks/ui/blocks/route-error';
import { queryClient } from '@raineworks/ui/lib/api';
import { SiteShell } from '@raineworks/web-marketing/components/site-shell';
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

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: HomePage,
});

const workRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/work',
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/work'), 'WorkPage'),
});

const projectsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/projects',
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/projects'), 'ProjectsPage'),
});

const hobbiesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/hobbies',
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/hobbies'), 'HobbiesPage'),
});

const contactRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/contact',
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
