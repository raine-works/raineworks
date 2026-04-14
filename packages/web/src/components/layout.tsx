/**
 * Root layout shell for the web micro-frontend.
 *
 * Provides a consistent page structure with a main content area.
 * Uses react-router's `Outlet` to render nested route content.
 *
 * @module components/layout
 */

import { ThemePicker } from '@rainestack/ui/components/blocks/theme-picker';
import { cn } from '@rainestack/ui/lib/utils';
import { Outlet } from 'react-router';

interface LayoutProps {
	className?: string;
}

export function Layout({ className }: LayoutProps) {
	return (
		<div className={cn('relative flex min-h-svh flex-col', className)}>
			<header className="fixed top-0 right-0 z-50 flex items-center p-4">
				<ThemePicker />
			</header>
			<main className="flex flex-1 flex-col">
				<Outlet />
			</main>
		</div>
	);
}
