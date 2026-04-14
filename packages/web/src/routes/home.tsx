/**
 * Home route — landing page for the web shell.
 *
 * Displays the landing page for the personal site. This is the default route
 * mounted at `/`.
 *
 * @module routes/home
 */

import { Button } from '@raineworks/ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/ui/card';
import { GitHubIcon } from '@web/components/github-icon';
import { Code, Database, Github, Layers, Rocket, ShieldCheck, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Feature cards
// ---------------------------------------------------------------------------

const features = [
	{
		icon: Layers,
		title: 'Turborepo Monorepo',
		description: 'One workspace for the site, server, shared UI, and data layer with fast incremental builds.',
		href: 'https://turborepo.dev/'
	},
	{
		icon: Database,
		title: 'Prisma + PostgreSQL',
		description: 'Type-safe database access with audit triggers, LISTEN/NOTIFY, and automatic change tracking.',
		href: 'https://www.prisma.io/'
	},
	{
		icon: Zap,
		title: 'oRPC + OpenAPI',
		description: 'End-to-end type-safe API with auto-generated OpenAPI spec and contract-driven clients.',
		href: 'https://orpc.dev/'
	},
	{
		icon: Code,
		title: 'React + Vite',
		description: 'A single frontend app with shared components and a fast local feedback loop.',
		href: 'https://vite.dev/'
	},
	{
		icon: Rocket,
		title: 'Bun Runtime',
		description: 'Lightning-fast server powered by Bun with hot-reloading and native TypeScript support.',
		href: 'https://bun.sh/'
	},
	{
		icon: ShieldCheck,
		title: 'Passwordless Auth',
		description: 'Email OTP, passkeys, and optional GitHub sign-in without carrying extra auth providers.',
		href: 'https://simplewebauthn.dev/'
	},
	{
		icon: Github,
		title: 'GitHub Integration',
		description: 'GitHub login stays available for social sign-in and account linking.',
		href: 'https://docs.github.com/apps/oauth-apps/building-oauth-apps'
	}
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Home() {
	return (
		<div className="flex min-h-screen flex-col">
			{/* Hero */}
			<section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
				<div className="flex flex-col items-center gap-4">
					<h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
						Raine<span className="text-primary">Works</span>
					</h1>
					<p className="max-w-xl text-lg text-muted-foreground">
						A personal site foundation with a Bun API, React frontend, shared UI system, and passwordless-first auth.
					</p>
				</div>

				<div className="flex gap-3">
					<a href="https://github.com/raine-works/raineworks" target="_blank" rel="noopener noreferrer">
						<Button size="lg" variant="outline">
							<GitHubIcon className="size-4" />
							GitHub
						</Button>
					</a>
				</div>
			</section>

			{/* Features */}
			<section className="mx-auto w-full max-w-5xl px-6 pb-24">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((feature) => (
						<Card key={feature.title} className="transition-shadow hover:shadow-md cursor-pointer">
							<a href={feature.href} target="_blank" rel="noopener noreferrer">
								<CardHeader>
									<feature.icon className="size-8 text-primary" />
									<CardTitle className="mt-2">{feature.title}</CardTitle>
									<CardDescription>{feature.description}</CardDescription>
								</CardHeader>
								<CardContent />
							</a>
						</Card>
					))}
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t py-6 text-center text-sm text-muted-foreground">
				<p className="flex items-center justify-center gap-2">
					RaineWorks &middot; Built by
					<a
						href="https://github.com/raine-works"
						className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
						target="_blank"
						rel="noopener noreferrer"
					>
						<GitHubIcon className="size-4" />
						raine-works
					</a>
				</p>
			</footer>
		</div>
	);
}
