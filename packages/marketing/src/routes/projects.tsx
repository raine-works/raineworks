import { projects } from '@/content/profile';

export function ProjectsPage() {
	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-accent"># projects</h1>
			<div className="grid gap-4 sm:grid-cols-2">
				{projects.map((project) => (
					<article key={project.name} className="border-border rounded-none border p-4">
						<h2 className="font-bold">{project.name}</h2>
						<p className="mt-1 text-text-dim text-sm leading-relaxed">{project.description}</p>
						<ul className="mt-3 flex flex-wrap gap-2 text-xs">
							{project.stack.map((tech) => (
								<li key={tech} className="border-accent-dim text-accent border px-2 py-0.5">
									{tech}
								</li>
							))}
						</ul>
						{project.href && (
							<a href={project.href} className="mt-3 inline-block text-accent hover:underline">
								./open →
							</a>
						)}
					</article>
				))}
			</div>
		</div>
	);
}
