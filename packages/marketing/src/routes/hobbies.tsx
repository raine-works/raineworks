import { hobbies } from '@/content/profile';

export function HobbiesPage() {
	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-accent"># hobbies</h1>
			<ul className="flex flex-col gap-3">
				{hobbies.map((hobby) => (
					<li key={hobby.name} className="flex gap-3">
						<span className="text-highlight">-</span>
						<div>
							<span className="font-bold">{hobby.name}</span>
							<span className="text-text-dim"> — {hobby.note}</span>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
