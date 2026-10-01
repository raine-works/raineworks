import { education, work } from '@/content/profile';

export function WorkPage() {
	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-accent"># work</h1>
			<div className="flex flex-col gap-6">
				{work.map((entry) => (
					<article key={`${entry.org}-${entry.role}`} className="border-border border-l-2 pl-4">
						<div className="flex flex-wrap items-baseline gap-2">
							<h2 className="font-bold">{entry.role}</h2>
							<a
								href={entry.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-text-dim hover:text-accent hover:underline"
							>
								@ {entry.org}
							</a>
						</div>
						<div className="text-highlight text-xs">{entry.period}</div>
						<p className="mt-1 text-text-dim leading-relaxed">{entry.summary}</p>
					</article>
				))}
			</div>
			<h2 className="mt-4 text-accent"># education</h2>
			<div className="flex flex-col gap-6">
				{education.map((entry) => (
					<article key={entry.school} className="border-border border-l-2 pl-4">
						<h3 className="font-bold">{entry.school}</h3>
						<div className="text-highlight text-xs">{entry.period}</div>
						<p className="mt-1 text-text-dim leading-relaxed">{entry.focus}</p>
					</article>
				))}
			</div>
		</div>
	);
}
