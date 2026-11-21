/**
 * The `/` page: who Raine is (the hero), what Raine is building now (bndl, Lux Financial), and the featured
 * projects (the repositories tagged `raineworks-featured` on GitHub).
 *
 * @module routes/home
 */

import { AppMark } from '@raineworks/ui/blocks/brand';
import { useDocumentTitle } from '@raineworks/ui/blocks/page';
import { Badge } from '@raineworks/ui/components/badge';
import { Button } from '@raineworks/ui/components/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { ProjectCards } from '@raineworks/web-marketing/components/project-card';
import { SectionHeading } from '@raineworks/web-marketing/components/section-heading';
import { SocialLinks } from '@raineworks/web-marketing/components/social-links';
import { isWritten, profile, work } from '@raineworks/web-marketing/content/profile';
import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, ArrowUpRightIcon, MapPinIcon } from 'lucide-react';

export function HomePage() {
	useDocumentTitle(profile.name);
	return (
		<div className="flex flex-col gap-16 md:gap-28">
			<section className="relative isolate">
				<div
					aria-hidden="true"
					className="bg-grid pointer-events-none absolute -inset-x-4 -top-8 -z-10 h-[28rem] md:-inset-x-8 md:-top-12"
				/>
				<div className="grid items-center gap-10 pt-2 md:grid-cols-[1fr_auto] md:pt-12">
					<div className="flex flex-col items-start gap-6">
						<Badge variant="outline" className="gap-1.5 rounded-full bg-background px-3 py-1 text-muted-foreground">
							<MapPinIcon />
							{profile.location}
						</Badge>
						<div className="flex flex-col gap-4">
							<h1 className="text-[2.75rem] leading-[1.05] font-semibold tracking-tighter text-balance sm:text-5xl md:text-7xl">
								<span className="text-gradient">{profile.name}</span>
							</h1>
							<p className="text-base text-balance text-muted-foreground sm:text-lg md:text-xl">{profile.title}</p>
						</div>
						<p className="max-w-xl text-lg leading-relaxed text-pretty md:text-xl md:leading-relaxed">
							{profile.tagline}
						</p>
						{isWritten(profile.bio) && (
							<p className="max-w-xl leading-relaxed text-pretty text-muted-foreground">{profile.bio}</p>
						)}
						<div className="flex w-full flex-wrap items-center gap-3 pt-2">
							<Button asChild size="lg" className="flex-1 sm:flex-none">
								<Link to="/projects">
									See my projects
									<ArrowRightIcon />
								</Link>
							</Button>
							<Button asChild size="lg" variant="outline" className="flex-1 bg-background sm:flex-none">
								<Link to="/contact">Get in touch</Link>
							</Button>
							<SocialLinks className="-ml-2 basis-full sm:ml-0 sm:basis-auto" />
						</div>
					</div>
					<div className="relative hidden md:block" aria-hidden="true">
						<div className="absolute inset-0 rounded-full gradient-glow opacity-25 dark:opacity-30" />
						<AppMark gradient className="relative size-72" strokeWidth={1.4} />
					</div>
				</div>
			</section>

			<section className="flex flex-col gap-6" aria-labelledby="now-heading">
				<SectionHeading eyebrow="Now" title="What I’m building" more={{ to: '/work', label: 'Work history' }} />
				<div className="grid items-start gap-4 md:grid-cols-2">
					{work.map((entry) => (
						<Card
							key={entry.org}
							className="gradient-border relative gap-2 has-[a:focus-visible]:[--gradient-border-mix:100%] has-[a:hover]:shadow-md has-[a:hover]:[--gradient-border-mix:100%]"
						>
							<CardHeader>
								<CardTitle className="text-lg">
									<h3>
										<a
											href={entry.href}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 item-link"
										>
											{entry.org}
											<ArrowUpRightIcon className="size-4 text-muted-foreground" />
										</a>
									</h3>
								</CardTitle>
								<CardDescription>{entry.role}</CardDescription>
								{isWritten(entry.summary) && <p className="pt-2 text-sm leading-relaxed">{entry.summary}</p>}
							</CardHeader>
						</Card>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeading
					eyebrow="Open source"
					title="Selected projects"
					more={{ to: '/projects', label: 'All projects' }}
				/>
				<div className="grid items-stretch gap-4 md:grid-cols-2">
					<ProjectCards featured placeholders={4} />
				</div>
			</section>
		</div>
	);
}
