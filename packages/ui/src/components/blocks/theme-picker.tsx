/**
 * Theme picker block — a dropdown button for switching between light, dark,
 * and system colour schemes.
 *
 * Renders a ghost icon button that opens a {@link DropdownMenu} with three
 * radio-style options. The active theme is indicated with a check mark. Uses
 * {@link useTheme} from the theme provider to read and write the current
 * selection.
 *
 * @module components/blocks/theme-picker
 */

import { Button } from '@ui/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@ui/components/ui/dropdown-menu';
import { cn } from '@ui/lib/utils';
import { type Theme, useTheme } from '@ui/providers/theme';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThemePickerProps {
	/** Optional className merged onto the trigger button. */
	className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
	{ value: 'light', label: 'Light', icon: <SunIcon /> },
	{ value: 'dark', label: 'Dark', icon: <MoonIcon /> },
	{ value: 'system', label: 'System', icon: <MonitorIcon /> }
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ThemePicker({ className }: ThemePickerProps) {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" className={cn('shrink-0', className)} aria-label="Toggle theme" />}
			>
				<SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
				<span className="sr-only">Toggle theme</span>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
					{THEME_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.icon}
							<span>{option.label}</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ThemePicker };
export type { ThemePickerProps };
