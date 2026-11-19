/**
 * The `/contact` page: email, GitHub and LinkedIn, and the contact form (`POST /api/contact`).
 *
 * @module routes/contact
 */

import { Page } from '@raineworks/ui/blocks/page';
import { Card, CardContent } from '@raineworks/ui/components/card';
import { GitHubIcon, LinkedInIcon } from '@raineworks/web-marketing/components/brand-icons';
import { ContactForm } from '@raineworks/web-marketing/components/contact-form';
import { profile } from '@raineworks/web-marketing/content/profile';
import { ArrowUpRightIcon, MailIcon } from 'lucide-react';

const CHANNELS = [
	{ label: 'Email', value: profile.contact.email, href: `mailto:${profile.contact.email}`, Icon: MailIcon },
	{ label: 'GitHub', value: 'raine-works', href: profile.contact.github, Icon: GitHubIcon },
	{ label: 'LinkedIn', value: 'rainepetersen', href: profile.contact.linkedin, Icon: LinkedInIcon },
] as const;

const isMail = (href: string) => href.startsWith('mailto:');

export function ContactPage() {
	return (
		<Page
			title="Contact"
			description="Email me, find me on GitHub or LinkedIn, or send a message below."
			className="max-w-2xl"
		>
			<Card className="gap-0 overflow-hidden py-0">
				<CardContent className="px-0">
					<ul className="divide-y">
						{CHANNELS.map(({ label, value, href, Icon }) => (
							<li key={label}>
								<a
									href={href}
									// GitHub and LinkedIn open in a new tab; email opens the mail app, so it stays (a new tab would be left blank).
									{...(isMail(href) ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
									className="group flex items-center gap-4 px-5 py-4 transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60"
								>
									<span
										className="flex size-9 items-center justify-center rounded-lg border bg-muted"
										aria-hidden="true"
									>
										<Icon className="size-4" />
									</span>
									<span className="flex flex-col">
										<span className="text-xs text-muted-foreground">{label}</span>
										<span className="font-medium">{value}</span>
									</span>
									{!isMail(href) && <span className="sr-only">(opens in a new tab)</span>}
									<ArrowUpRightIcon
										aria-hidden="true"
										className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
									/>
								</a>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
			<ContactForm />
		</Page>
	);
}
