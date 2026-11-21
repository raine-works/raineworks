/**
 * The marketing zone's layout around every page: a sticky header (the logo, the pages, the theme and, on phones, the
 * menu), the page, and a footer (the logo, the version opening About, the social links and the coffee button).
 *
 * The accent gradient (`globals.css`) is in the logo's mark, the hairlines under the header and over the footer, and
 * under the page you're on.
 *
 * @module components/site-shell
 */

import { AppLogo } from '@raineworks/ui/blocks/brand';
import { VersionLabel } from '@raineworks/ui/blocks/release-notes';
import { ThemeToggle } from '@raineworks/ui/blocks/theme-toggle';
import { COPYRIGHT_HOLDER } from '@raineworks/ui/lib/brand';
import { CoffeeButton } from '@raineworks/web-marketing/components/coffee-button';
import { MobileNav } from '@raineworks/web-marketing/components/mobile-nav';
import { useNavLinks } from '@raineworks/web-marketing/components/nav';
import { SocialLinks } from '@raineworks/web-marketing/components/social-links';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/** The header, `children` (the page), and the footer. */
export function SiteShell({ children }: { children: ReactNode }) {
	const links = useNavLinks();
	return (
		<div className="relative flex min-h-screen flex-col">
			<header className="sticky top-0 z-40 bg-background/75 backdrop-blur-md">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 md:h-16 md:px-8">
					<Link
						to="/"
						aria-label="raineworks, home"
						className="-mx-1 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<AppLogo gradient className="h-6" />
					</Link>
					<nav aria-label="Main" className="ml-auto hidden items-center gap-0.5 md:flex">
						{links
							.filter((link) => link.to !== '/')
							.map((link) => (
								<Link
									key={link.to}
									to={link.to}
									activeProps={{ className: 'text-foreground bg-accent' }}
									inactiveProps={{ className: 'text-muted-foreground' }}
									className="group relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
								>
									{link.label}
									{/* The page you're on (or in): a short stroke of the accent under its name. */}
									<span
										aria-hidden="true"
										className="absolute inset-x-3 -bottom-px hidden gradient-hairline opacity-80 group-aria-[current=page]:block"
									/>
								</Link>
							))}
					</nav>
					<div className="ml-auto flex items-center gap-1 md:ml-2">
						<ThemeToggle />
						<MobileNav />
					</div>
				</div>
				<div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-b border-border/60" />
				<div aria-hidden="true" className="absolute inset-x-0 -bottom-px gradient-hairline opacity-50" />
			</header>

			<main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">{children}</main>

			<footer className="relative border-t border-border/60">
				<div aria-hidden="true" className="absolute inset-x-0 -top-px gradient-hairline opacity-40" />
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8">
					<div className="flex flex-col gap-2">
						<AppLogo className="h-5 self-start text-muted-foreground" />
						{/* Prerendered with the year it was built in: the year it's read in wins, without a warning. */}
						<p suppressHydrationWarning className="text-sm text-muted-foreground">
							© {new Date().getFullYear()} {COPYRIGHT_HOLDER}. Open source under the MIT License.
						</p>
						<VersionLabel className="-mx-1" />
					</div>
					{/* Phones: one row across the footer, the icons at the left (lined up with the text above), the coffee button at the right. */}
					<div className="flex items-center justify-between gap-3 md:justify-start">
						<SocialLinks className="-ml-2 md:ml-0" />
						<CoffeeButton />
					</div>
				</div>
			</footer>
		</div>
	);
}
