/**
 * The Buy Me a Coffee link, as an outline button.
 *
 * @module components/coffee-button
 */

import { Button } from '@raineworks/ui/components/button';
import { profile } from '@raineworks/web-marketing/content/profile';
import { CoffeeIcon } from 'lucide-react';

export function CoffeeButton({ size = 'sm' }: { size?: 'sm' | 'default' }) {
	return (
		<Button asChild variant="outline" size={size}>
			<a href={profile.contact.coffee} target="_blank" rel="noopener noreferrer">
				<CoffeeIcon />
				Buy me a coffee
			</a>
		</Button>
	);
}
