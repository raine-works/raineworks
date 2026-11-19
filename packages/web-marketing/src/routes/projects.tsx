/**
 * The `/projects` page: every project (the repositories tagged `raineworks` on GitHub), as cards opening them.
 *
 * @module routes/projects
 */

import { Page } from '@raineworks/ui/blocks/page';
import { ProjectCards } from '@raineworks/web-marketing/components/project-card';

export function ProjectsPage() {
	return (
		<Page title="Projects" description="Things I build in the open, mostly for my homelab and my own workflow.">
			<div className="grid items-stretch gap-4 md:grid-cols-2">
				<ProjectCards placeholders={6} />
			</div>
		</Page>
	);
}
