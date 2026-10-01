import { CoffeeButton } from '@/components/CoffeeButton';
import { profile } from '@/content/profile';

export function ContactPage() {
	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-accent"># contact</h1>
			<div className="flex flex-col gap-2 text-sm">
				<a href={`mailto:${profile.contact.email}`} className="text-text-dim hover:text-accent">
					email: <span className="text-text">{profile.contact.email}</span>
				</a>
				<a href={profile.contact.github} className="text-text-dim hover:text-accent">
					github: <span className="text-text">{profile.contact.github}</span>
				</a>
				<a href={profile.contact.linkedin} className="text-text-dim hover:text-accent">
					linkedin: <span className="text-text">{profile.contact.linkedin}</span>
				</a>
			</div>
			<div className="pt-2">
				<CoffeeButton />
			</div>
		</div>
	);
}
