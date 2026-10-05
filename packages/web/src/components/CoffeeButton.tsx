import { profile } from '@/content/profile';

export function CoffeeButton() {
	return (
		<a
			href={profile.contact.coffee}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-2 rounded border border-highlight px-3 py-1.5 text-highlight text-sm transition-colors hover:bg-highlight hover:text-bg focus-visible:outline-2 focus-visible:outline-highlight focus-visible:outline-offset-2"
		>
			<span aria-hidden="true">$</span>
			<span>buy-me-a-coffee</span>
			<span aria-hidden="true">☕</span>
		</a>
	);
}
