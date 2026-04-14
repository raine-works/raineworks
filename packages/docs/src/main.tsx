/**
 * Docs — application entry point.
 *
 * Mounts the React root, imports the shared design-system theme, and wraps
 * the application in the provider stack (theme toggling, TanStack Query).
 *
 * This is the docs micro-frontend served under the `/docs` base path.
 *
 * @module main
 */

import '@rainestack/tools/prototypes';
import '@rainestack/tools/temporal-polyfill';
import '@docs/styles/global.css';

import { App } from '@docs/app';
import { QueryProvider } from '@rainestack/api/query-provider';
import { Toaster } from '@rainestack/ui/components/ui/sonner';
import { ThemeProvider } from '@rainestack/ui/providers/theme';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = document.getElementById('root');

if (!root) {
	throw new Error('Missing #root element in index.html');
}

createRoot(root).render(
	<StrictMode>
		<ThemeProvider>
			<QueryProvider>
				<App />
				<Toaster richColors />
			</QueryProvider>
		</ThemeProvider>
	</StrictMode>
);
