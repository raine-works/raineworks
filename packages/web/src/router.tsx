import { createRoute, createRouter } from '@tanstack/react-router';
import { Route as rootRoute } from '@/routes/__root';
import { ContactPage } from '@/routes/contact';
import { HobbiesPage } from '@/routes/hobbies';
import { HomePage } from '@/routes/index';
import { ProjectsPage } from '@/routes/projects';
import { WorkPage } from '@/routes/work';

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: HomePage,
});

const workRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/work',
	component: WorkPage,
});

const projectsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/projects',
	component: ProjectsPage,
});

const hobbiesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/hobbies',
	component: HobbiesPage,
});

const contactRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/contact',
	component: ContactPage,
});

export const routeTree = rootRoute.addChildren([indexRoute, workRoute, projectsRoute, hobbiesRoute, contactRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
