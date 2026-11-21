/**
 * The `/hobbies` page: each hobby as a card with its icon.
 *
 * @module routes/hobbies
 */

import { Page } from '@raineworks/ui/blocks/page';
import { Card, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { hobbies } from '@raineworks/web-marketing/content/profile';
import {
	BikeIcon,
	CarIcon,
	CodeXmlIcon,
	FlagIcon,
	Gamepad2Icon,
	type LucideIcon,
	ServerIcon,
	WrenchIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
	Homelab: ServerIcon,
	'Software development': CodeXmlIcon,
	Tinkering: WrenchIcon,
	'Video games': Gamepad2Icon,
	Golf: FlagIcon,
	Motorcycles: BikeIcon,
	Cars: CarIcon,
};

export function HobbiesPage() {
	return (
		<Page title="Hobbies" description="What I do when I’m not at a keyboard (and some of when I am).">
			<ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{hobbies.map((hobby) => {
					const Icon = ICONS[hobby.name] ?? WrenchIcon;
					return (
						<li key={hobby.name}>
							<Card className="h-full">
								{/* Phones: the icon beside the name and note, so each card is a line or two; stacked from sm. */}
								<CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 sm:grid-cols-1 sm:gap-3">
									<span
										className="row-span-2 flex size-9 items-center justify-center rounded-lg border bg-muted text-foreground sm:row-span-1"
										aria-hidden="true"
									>
										<Icon className="size-4" />
									</span>
									<CardTitle className="self-center sm:self-auto">
										<h2>{hobby.name}</h2>
									</CardTitle>
									<CardDescription className="leading-relaxed">{hobby.note}</CardDescription>
								</CardHeader>
							</Card>
						</li>
					);
				})}
			</ul>
		</Page>
	);
}
