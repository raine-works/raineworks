/**
 * The `/projects` page: every project in `content/profile`, as cards opening their repositories.
 *
 * @module routes/projects
 */

import { Page } from '@raineworks/ui/blocks/page';
import { ProjectCard } from '@raineworks/web-marketing/components/project-card';
import { projects } from '@raineworks/web-marketing/content/profile';

export function ProjectsPage() {
	return (
		<Page title="Projects" description="Things I build in the open, mostly for my homelab and my own workflow.">
			<div className="grid items-stretch gap-4 md:grid-cols-2">
				{projects.map((project) => (
					<ProjectCard key={project.name} project={project} />
				))}
			</div>
		</Page>
	);
}
