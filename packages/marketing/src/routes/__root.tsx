import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { CoffeeButton } from '@/components/CoffeeButton';
import { NotFoundPage } from '@/routes/not-found';

const NAV_LINKS = [
	{ to: '/', label: 'home' },
	{ to: '/work', label: 'work' },
	{ to: '/projects', label: 'projects' },
	{ to: '/hobbies', label: 'hobbies' },
	{ to: '/contact', label: 'contact' },
] as const;

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFoundPage,
});

function RootLayout() {
	return (
		<div className="crt-scanlines mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-4 py-10">
			<header className="flex flex-wrap items-center justify-between gap-4 border-border border-b pb-4">
				<Link to="/" className="text-accent font-bold">
					~/raine
				</Link>
				<nav className="flex flex-wrap gap-4 text-sm">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							activeOptions={{ exact: link.to === '/' }}
							activeProps={{ className: 'text-accent' }}
							inactiveProps={{ className: 'text-text-dim hover:text-text' }}
							className="transition-colors"
						>
							./{link.label}
						</Link>
					))}
				</nav>
			</header>

			<main className="flex-1">
				<Outlet />
			</main>

			<footer className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-4 text-text-dim text-xs">
				<span>raineworks/marketing</span>
				<CoffeeButton />
			</footer>
		</div>
	);
}
