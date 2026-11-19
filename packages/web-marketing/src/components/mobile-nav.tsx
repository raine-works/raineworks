/**
 * The site's pages in a sheet from the right, for phones (ui-sdk's Drawer: focus, Escape, swipe to close). Hidden
 * from `md` up, where the header lists them.
 *
 * @module components/mobile-nav
 */

import { buttonVariants } from '@raineworks/ui/components/button';
import { cn } from '@raineworks/ui/lib/utils';
import { useNavLinks } from '@raineworks/web-marketing/components/nav';
import { Link } from '@tanstack/react-router';
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@ui-sdk/react/drawer';
import { MenuIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

/** The site's pages in a sheet from the right, for phones (ui-sdk's Drawer: focus, Escape, swipe to close). */
export function MobileNav() {
	const [open, setOpen] = useState(false);
	const links = useNavLinks();
	return (
		<Drawer side="right" open={open} onOpenChange={setOpen}>
			<DrawerTrigger
				aria-label="Menu"
				data-slot="button"
				data-size="icon"
				className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden')}
			>
				<MenuIcon />
			</DrawerTrigger>
			<DrawerBackdrop className="fixed inset-0 z-50 m-0 size-auto border-0 bg-black/50 p-0" />
			<DrawerContent className="flex h-full w-72 max-w-[85vw] flex-col gap-4 border-l bg-background p-5 shadow-lg">
				<div className="flex items-center justify-between">
					<DrawerTitle className="font-semibold">Menu</DrawerTitle>
					<DrawerClose
						aria-label="Close"
						data-slot="button"
						data-size="icon"
						className={buttonVariants({ variant: 'ghost', size: 'icon' })}
					>
						<XIcon />
					</DrawerClose>
				</div>
				<nav className="flex flex-col gap-1">
					{links.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							onClick={() => setOpen(false)}
							activeOptions={{ exact: link.to === '/' }}
							activeProps={{ className: 'bg-accent text-brand-ink' }}
							inactiveProps={{ className: 'text-muted-foreground' }}
							className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{link.label}
						</Link>
					))}
				</nav>
			</DrawerContent>
		</Drawer>
	);
}
