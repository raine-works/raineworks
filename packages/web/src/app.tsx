/**
 * Root application component for the web (shell/host) micro-frontend.
 *
 * Owns the top-level routing, layout chrome, and acts as the catch-all
 * for unmatched routes. Additional micro-frontend zones (e.g. `/docs`)
 * are served by their own independent apps via the Turborepo
 * microfrontends proxy.
 *
 * @module app
 */

import { NotFound } from '@rainestack/ui/components/blocks/not-found';
import { Layout } from '@web/components/layout';
import { Home } from '@web/routes/home';
import { BrowserRouter, Route, Routes } from 'react-router';

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<Layout />}>
					<Route index element={<Home />} />
					<Route path="*" element={<NotFound homeHref="/" homeLabel="Go home" />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
