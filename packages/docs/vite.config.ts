/**
 * Vite configuration for the docs micro-frontend.
 *
 * This application is served under the `/docs` base path by the
 * Turborepo microfrontends proxy in development and by the server's
 * static file handler in production.
 *
 * @module vite.config
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [['babel-plugin-react-compiler']]
			}
		}),
		// Disable the Tailwind plugin's internal Lightning CSS minification.
		// Lightning CSS strips the required space between the color and percentage
		// in color-mix() expressions (e.g. `var(--destructive) 10%` becomes
		// `var(--destructive)10%`), which silently breaks all Tailwind opacity
		// modifiers like `bg-destructive/10`. Vite's esbuild minifier (configured
		// below via `cssMinify: 'esbuild'`) handles CSS minification correctly.
		tailwindcss({ optimize: { minify: false } })
	],

	// All assets and routes are served under /docs.
	base: '/docs',

	server: {
		// Turborepo injects TURBO_MFE_PORT when running via the microfrontends
		// proxy (`turbo dev`). Fall back to 3101 for standalone dev.
		port: Number(process.env.TURBO_MFE_PORT) || 3101,
		strictPort: true,

		// Proxy API requests to the backend server during local development.
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true
			}
		}
	},

	resolve: {
		alias: {
			'@docs': new URL('./src', import.meta.url).pathname,
			'@api': new URL('../api/src', import.meta.url).pathname,
			'@rainestack/ui': new URL('../ui/src', import.meta.url).pathname,
			'@ui': new URL('../ui/src', import.meta.url).pathname
		}
	},

	build: {
		outDir: 'dist',
		sourcemap: true,

		// Use esbuild for CSS minification instead of the default Lightning CSS.
		// See the tailwindcss() plugin comment above for details.
		cssMinify: 'esbuild',
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) return;

					// Use the last node_modules/ segment to extract the real package
					// name. Bun hoists into node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>/,
					// so the first segment would incorrectly resolve to ".bun".
					const i = id.lastIndexOf('node_modules/');
					const afterNm = id.slice(i + 'node_modules/'.length);
					const pkg = afterNm.startsWith('@') ? afterNm.split('/').slice(0, 2).join('/') : afterNm.split('/')[0];

					// React core — very stable, cached aggressively by the browser.
					if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') {
						return 'vendor-react';
					}

					// All other third-party dependencies.
					return 'vendor';
				}
			}
		}
	}
});
