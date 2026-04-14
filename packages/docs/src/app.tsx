/**
 * Root application component for the docs micro-frontend.
 *
 * Simple empty docs page ready for customization.
 *
 * @module app
 */

import { MDXPage } from '@docs/components/mdx-page';
import { ThemePicker } from '@rainestack/ui/components/blocks/theme-picker';
import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';

function DocsLayout({ children }: { children: ReactElement }) {
	return (
		<div className="relative min-h-screen">
			<header className="fixed top-0 right-0 z-50 flex items-center p-4">
				<ThemePicker />
			</header>
			<main>{children}</main>
		</div>
	);
}

function Home(): ReactElement {
	return (
		<div className="min-h-screen bg-background">
			<div className="container max-w-4xl py-16 px-6">
				<div className="space-y-8">
					<div className="space-y-4">
						<h1 className="text-4xl font-bold tracking-tight">RaineStack Documentation</h1>
						<p className="text-xl text-muted-foreground">
							A modern full-stack TypeScript starter built with Bun, Turborepo, Prisma, and React.
						</p>
					</div>

					<div className="flex gap-3 justify-center">
						<a
							href="/docs/getting-started"
							className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							Get Started
						</a>
						<a
							href="/"
							className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
						>
							Back to App
						</a>
						<a
							href="/api/openapi.json"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
						>
							View API Spec
						</a>
					</div>

					<div className="rounded-lg border bg-card p-8 space-y-4">
						<h2 className="text-2xl font-semibold">Quick Start</h2>
						<div className="rounded-md bg-muted p-4">
							<pre className="text-sm overflow-x-auto">
								<code>
									{`# Install dependencies
bun install

# Start PostgreSQL
bun run db:start
bun run db:dev

# Start all dev servers
bun run dev

# Visit http://localhost:3024`}
								</code>
							</pre>
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="rounded-lg border bg-card p-6 space-y-2">
							<h3 className="font-semibold">Type-Safe APIs</h3>
							<p className="text-sm text-muted-foreground">
								oRPC with auto-generated OpenAPI spec and type-safe clients
							</p>
						</div>
						<div className="rounded-lg border bg-card p-6 space-y-2">
							<h3 className="font-semibold">Full Auth Stack</h3>
							<p className="text-sm text-muted-foreground">JWT, OTP, OIDC (Google/GitHub), and WebAuthn passkeys</p>
						</div>
						<div className="rounded-lg border bg-card p-6 space-y-2">
							<h3 className="font-semibold">Audit Trail</h3>
							<p className="text-sm text-muted-foreground">
								Automatic change tracking with actor attribution for compliance
							</p>
						</div>
						<div className="rounded-lg border bg-card p-6 space-y-2">
							<h3 className="font-semibold">Real-time Updates</h3>
							<p className="text-sm text-muted-foreground">LISTEN/NOTIFY for cross-instance awareness</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function App(): ReactElement {
	return (
		<BrowserRouter basename="/docs">
			<Routes>
				<Route
					index
					element={
						<DocsLayout>
							<Home />
						</DocsLayout>
					}
				/>
				<Route
					path="getting-started"
					element={
						<DocsLayout>
							<MDXPage slug="getting-started" />
						</DocsLayout>
					}
				/>
				<Route
					path="*"
					element={
						<DocsLayout>
							<div className="flex min-h-screen items-center justify-center p-6 text-center">
								<div className="space-y-4">
									<h1 className="text-2xl font-bold">404 - Page Not Found</h1>
									<a href="/docs" className="text-primary hover:underline">
										Back to docs
									</a>
								</div>
							</div>
						</DocsLayout>
					}
				/>
			</Routes>
		</BrowserRouter>
	);
}
