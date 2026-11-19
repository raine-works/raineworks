/**
 * Light, dark or the system's scheme (`hooks/use-theme`), from an icon button in the header. Built on ui-sdk's Menu
 * for the behaviour (focus, arrow keys, typeahead, dismissal) and styled like shadcn's dropdown menu.
 *
 * @module blocks/theme-toggle
 */

import { buttonVariants } from '@raineworks/ui/components/button';
import { type Theme, THEMES, useTheme } from '@raineworks/ui/hooks/use-theme';
import {
	Menu,
	MenuContent,
	MenuGroupLabel,
	MenuItemIndicator,
	MenuRadioGroup,
	MenuRadioItem,
	MenuTrigger,
} from '@ui-sdk/react/menu';
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

const ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;
const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

/** An icon button choosing the theme; it shows the chosen one's icon. */
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const Icon = ICONS[theme];
	return (
		<Menu>
			<MenuTrigger
				aria-label={`Theme: ${LABELS[theme]}`}
				data-slot="button"
				data-size="icon"
				className={buttonVariants({ variant: 'ghost', size: 'icon' })}
			>
				<Icon />
			</MenuTrigger>
			<MenuContent
				align="end"
				sideOffset={4}
				className="z-50 min-w-36 origin-(--transform-origin) rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
			>
				<MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
					<MenuGroupLabel className="px-2 py-1.5 text-sm font-medium">Theme</MenuGroupLabel>
					{THEMES.map((option) => (
						<MenuRadioItem
							key={option}
							value={option}
							className="relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
						>
							<MenuItemIndicator className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
								<CheckIcon className="size-4" />
							</MenuItemIndicator>
							{LABELS[option]}
						</MenuRadioItem>
					))}
				</MenuRadioGroup>
			</MenuContent>
		</Menu>
	);
}
