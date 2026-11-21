/**
 * Icon buttons to GitHub, LinkedIn, X and email.
 *
 * @module components/social-links
 */

import { Button } from '@raineworks/ui/components/button';
import { cn } from '@raineworks/ui/lib/utils';
import { GitHubIcon, LinkedInIcon, XIcon } from '@raineworks/web-marketing/components/brand-icons';
import { profile } from '@raineworks/web-marketing/content/profile';
import { MailIcon } from 'lucide-react';

const LINKS = [
	{ label: 'GitHub', href: profile.contact.github, Icon: GitHubIcon },
	{ label: 'LinkedIn', href: profile.contact.linkedin, Icon: LinkedInIcon },
	{ label: 'X', href: profile.contact.x, Icon: XIcon },
	{ label: 'Email', href: `mailto:${profile.contact.email}`, Icon: MailIcon },
] as const;

/** Icon buttons to GitHub, LinkedIn, X and email. */
export function SocialLinks({ className }: { className?: string }) {
	return (
		<ul className={cn('flex items-center gap-1', className)}>
			{LINKS.map(({ label, href, Icon }) => (
				<li key={label}>
					<Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
						<a
							href={href}
							aria-label={label}
							target={href.startsWith('mailto:') ? undefined : '_blank'}
							rel="noopener noreferrer"
						>
							<Icon className="size-4" />
						</a>
					</Button>
				</li>
			))}
		</ul>
	);
}
