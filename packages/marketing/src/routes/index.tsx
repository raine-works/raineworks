import { TerminalPrompt } from '@/components/TerminalPrompt';
import { profile } from '@/content/profile';

export function HomePage() {
	return (
		<div className="flex flex-col gap-8">
			<TerminalPrompt command="whoami" output={[profile.name, profile.title, profile.location]} />
			<p className="max-w-xl text-text-dim leading-relaxed">{profile.tagline}</p>
			<p className="max-w-xl leading-relaxed">{profile.bio}</p>
		</div>
	);
}
