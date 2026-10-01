import { profile } from '@/content/profile';

export function BuyMeACoffeeButton() {
	return (
		<a
			href={profile.contact.buyMeACoffee}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-2 rounded border border-highlight px-3 py-1.5 font-bold text-highlight text-sm transition-colors hover:bg-highlight hover:text-bg"
		>
			<span aria-hidden="true">☕</span>
			buy me a coffee
		</a>
	);
}
