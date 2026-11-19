/**
 * The `/articles` page: Raine's articles on X, newest first, each opening it there, and the RSS feed. Only on with
 * the server's X API token; without one, the server sends the 404 in its place.
 *
 * @module routes/articles
 */

import { Page } from '@raineworks/ui/blocks/page';
import { Button } from '@raineworks/ui/components/button';
import { ArticleList } from '@raineworks/web-marketing/components/articles';
import { XIcon } from '@raineworks/web-marketing/components/brand-icons';
import { profile } from '@raineworks/web-marketing/content/profile';
import { RssIcon } from 'lucide-react';

export function ArticlesPage() {
	return (
		<Page title="Articles" description="What I write on X, newest first.">
			<div className="flex flex-wrap gap-2">
				<Button asChild variant="outline" size="sm">
					<a href={profile.contact.x} target="_blank" rel="noopener noreferrer">
						<XIcon className="size-3.5" />
						Follow @raineworks
					</a>
				</Button>
				<Button asChild variant="outline" size="sm">
					<a href="/feed.xml" type="application/rss+xml">
						<RssIcon />
						RSS feed
					</a>
				</Button>
			</div>
			<div className="grid items-start gap-4">
				<ArticleList />
			</div>
		</Page>
	);
}
