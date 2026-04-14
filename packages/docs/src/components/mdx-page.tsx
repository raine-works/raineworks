/**
 * MDX page component using react-markdown.
 *
 * Fetches and renders MDX/Markdown documentation files with beautiful styling,
 * syntax highlighting, and proper typography.
 *
 * @module components/mdx-page
 */

import { Alert, AlertDescription, AlertTitle } from '@rainestack/ui/components/ui/alert';
import { Button } from '@rainestack/ui/components/ui/button';
import { Skeleton } from '@rainestack/ui/components/ui/skeleton';
import { cn } from '@rainestack/ui/lib/utils';
import { AlertCircle, AlertTriangle, Check, Copy, Info, Lightbulb, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface MDXPageProps {
	slug: string;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={handleCopy}
			className="absolute right-2 top-2 size-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
		>
			{copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
			<span className="sr-only">Copy code</span>
		</Button>
	);
}

function CalloutBox({ type, children }: { type: string; children: ReactNode }) {
	const configs = {
		note: {
			icon: Info,
			classes: 'border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-950/30',
			iconClasses: 'text-blue-600 dark:text-blue-400',
			titleClasses: 'text-blue-900 dark:text-blue-100'
		},
		tip: {
			icon: Lightbulb,
			classes: 'border-green-200 bg-green-50/50 dark:border-green-500/30 dark:bg-green-950/30',
			iconClasses: 'text-green-600 dark:text-green-400',
			titleClasses: 'text-green-900 dark:text-green-100'
		},
		warning: {
			icon: AlertTriangle,
			classes: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-500/30 dark:bg-yellow-950/30',
			iconClasses: 'text-yellow-600 dark:text-yellow-400',
			titleClasses: 'text-yellow-900 dark:text-yellow-100'
		},
		error: {
			icon: XCircle,
			classes: 'border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-950/30',
			iconClasses: 'text-red-600 dark:text-red-400',
			titleClasses: 'text-red-900 dark:text-red-100'
		},
		info: {
			icon: AlertCircle,
			classes: 'border-purple-200 bg-purple-50/50 dark:border-purple-500/30 dark:bg-purple-950/30',
			iconClasses: 'text-purple-600 dark:text-purple-400',
			titleClasses: 'text-purple-900 dark:text-purple-100'
		},
		important: {
			icon: AlertCircle,
			classes: 'border-purple-200 bg-purple-50/50 dark:border-purple-500/30 dark:bg-purple-950/30',
			iconClasses: 'text-purple-600 dark:text-purple-400',
			titleClasses: 'text-purple-900 dark:text-purple-100'
		}
	};

	const config = configs[type.toLowerCase() as keyof typeof configs] || configs.note;
	const Icon = config.icon;

	return (
		<div className={cn('my-6 rounded-lg border-l-4 p-4', config.classes)}>
			<div className="flex gap-3">
				<Icon className={cn('size-5 shrink-0 mt-0.5', config.iconClasses)} />
				<div className="flex-1 text-sm leading-relaxed space-y-2">
					<div className={cn('font-semibold uppercase text-xs tracking-wide', config.titleClasses)}>{type}</div>
					<div className="[&>p]:my-0 [&>p]:text-sm [&>code]:text-xs">{children}</div>
				</div>
			</div>
		</div>
	);
}

export function MDXPage({ slug }: MDXPageProps) {
	const [content, setContent] = useState<string | null>(null);
	const [metadata, setMetadata] = useState<{ title?: string; description?: string } | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;

		async function loadMDX() {
			setLoading(true);
			setError(null);

			try {
				const response = await fetch(`/docs/content/${slug}.mdx`);

				if (!response.ok) {
					throw new Error(`Failed to load ${slug}.mdx`);
				}

				const text = await response.text();

				// Parse frontmatter
				const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
				const parsedMetadata: { title?: string; description?: string } = {};
				let mdContent = text;

				if (frontmatterMatch) {
					const frontmatter = frontmatterMatch[1];
					const titleMatch = frontmatter.match(/title:\s*(.+)/);
					const descMatch = frontmatter.match(/description:\s*(.+)/);

					if (titleMatch) parsedMetadata.title = titleMatch[1].trim();
					if (descMatch) parsedMetadata.description = descMatch[1].trim();

					// Remove frontmatter from content
					mdContent = text.slice(frontmatterMatch[0].length).trim();
				}

				// Parse GitHub-style callouts
				const enhancedContent = mdContent.replace(/^>\s*\*\*(\w+):\*\*\s*(.+)$/gim, (_match, type, content) => {
					return `<Callout type="${type}">\n\n${content}\n\n</Callout>`;
				});

				if (mounted) {
					setContent(enhancedContent);
					setMetadata(parsedMetadata);
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err.message : 'Failed to load documentation');
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		}

		loadMDX();

		return () => {
			mounted = false;
		};
	}, [slug]);

	if (loading) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container max-w-4xl py-16 px-6">
					<div className="space-y-6">
						<Skeleton className="h-12 w-3/4" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-48 w-full" />
					</div>
				</div>
			</div>
		);
	}

	if (error || !content) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container max-w-4xl py-16 px-6">
					<Alert variant="destructive">
						<AlertCircle className="size-4" />
						<AlertTitle>Error Loading Documentation</AlertTitle>
						<AlertDescription>{error || 'Documentation not found'}</AlertDescription>
					</Alert>
					<div className="mt-6">
						<a href="/docs" className="text-primary hover:underline">
							← Back to documentation
						</a>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="container max-w-4xl py-16 px-6">
				<div className="mb-8">
					<a href="/docs" className="text-sm text-primary hover:underline">
						← Back to docs
					</a>
				</div>

				<article
					className={cn(
						'prose prose-slate dark:prose-invert max-w-none',
						// Headings
						'prose-headings:scroll-mt-20 prose-headings:font-semibold prose-headings:tracking-tight',
						'prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-8 prose-h1:mt-0',
						'prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-16 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b',
						'prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-12 prose-h3:mb-4',
						'prose-h4:text-lg prose-h4:font-semibold prose-h4:mt-8 prose-h4:mb-3',
						// Text
						'prose-p:leading-7 prose-p:my-6 prose-p:text-muted-foreground',
						'prose-lead:text-xl prose-lead:text-muted-foreground',
						'prose-strong:font-semibold prose-strong:text-foreground',
						// Links
						'prose-a:text-primary prose-a:font-medium prose-a:underline prose-a:underline-offset-4',
						'hover:prose-a:text-primary/80 prose-a:transition-colors',
						// Code
						'prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5',
						'prose-code:text-sm prose-code:font-mono prose-code:text-foreground',
						'prose-code:before:content-none prose-code:after:content-none',
						'prose-code:border prose-code:border-border/50',
						// Code blocks
						'prose-pre:bg-zinc-950 dark:prose-pre:bg-zinc-900',
						'prose-pre:border prose-pre:rounded-xl prose-pre:p-0',
						'prose-pre:overflow-hidden prose-pre:my-8',
						'prose-pre:shadow-lg prose-pre:ring-1 prose-pre:ring-border/50',
						// Lists
						'prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6 prose-ul:space-y-2',
						'prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6 prose-ol:space-y-2',
						'prose-li:text-muted-foreground prose-li:marker:text-primary',
						// Blockquotes
						'prose-blockquote:border-l-4 prose-blockquote:border-primary/50',
						'prose-blockquote:pl-6 prose-blockquote:py-2',
						'prose-blockquote:italic prose-blockquote:text-muted-foreground',
						'prose-blockquote:my-6 prose-blockquote:bg-muted/20 prose-blockquote:rounded-r',
						// Tables
						'prose-table:my-8 prose-table:w-full prose-table:border-collapse',
						'prose-table:rounded-lg prose-table:overflow-hidden',
						'prose-table:shadow-sm prose-table:border',
						'prose-th:bg-muted prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold',
						'prose-td:border prose-td:px-4 prose-td:py-3 prose-td:text-sm',
						// Images
						'prose-img:rounded-lg prose-img:border prose-img:my-8 prose-img:shadow-md',
						// HR
						'prose-hr:my-12 prose-hr:border-border'
					)}
				>
					{metadata?.title && <h1>{metadata.title}</h1>}
					{metadata?.description && <p className="lead">{metadata.description}</p>}

					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={[rehypeRaw]}
						components={{
							// Links
							a: ({ href, children, ...props }) => {
								const isExternal = href?.startsWith('http');
								return (
									<a
										href={href}
										target={isExternal ? '_blank' : undefined}
										rel={isExternal ? 'noopener noreferrer' : undefined}
										{...props}
									>
										{children}
									</a>
								);
							},

							// Code blocks with copy button
							pre: ({ children, ...props }) => {
								let textContent = '';
								try {
									if (children && typeof children === 'object' && 'props' in children) {
										const codeElement = children as { props?: { children?: string } };
										textContent = codeElement.props?.children || '';
									}
								} catch {
									// Fallback
								}

								return (
									<div className="group relative my-8">
										<pre className="overflow-x-auto p-4 bg-zinc-950 dark:bg-zinc-900 rounded-xl" {...props}>
											{children}
										</pre>
										{textContent && <CopyButton text={textContent} />}
									</div>
								);
							},

							// Inline code
							code: ({ children, className, ...props }) => {
								const isInline = !className?.includes('language-');

								if (isInline) {
									return (
										<code
											className="relative rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground border border-border/50"
											{...props}
										>
											{children}
										</code>
									);
								}

								return (
									<code className={cn('font-mono text-sm text-zinc-100', className)} {...props}>
										{children}
									</code>
								);
							},

							// Blockquotes
							blockquote: ({ children, ...props }) => {
								// Check if it's a callout
								const firstChild = children && typeof children === 'object' && 'props' in children;
								if (firstChild) {
									const childElement = children as { props?: { children?: ReactNode } };
									const text = childElement.props?.children;
									if (typeof text === 'string' && text.match(/^\*\*(\w+):\*\*/)) {
										const match = text.match(/^\*\*(\w+):\*\*\s*(.+)$/);
										if (match) {
											return <CalloutBox type={match[1]}>{match[2]}</CalloutBox>;
										}
									}
								}

								return (
									<blockquote
										className="border-l-4 border-primary/50 pl-6 py-2 italic text-muted-foreground my-6 bg-muted/20 rounded-r"
										{...props}
									>
										{children}
									</blockquote>
								);
							},

							// Custom Callout component
							Callout: ({ type, children }: { type?: string; children?: ReactNode }) => (
								<CalloutBox type={type || 'note'}>{children}</CalloutBox>
							),

							// Headings
							h1: ({ children, ...props }) => (
								<h1 className="text-4xl font-bold tracking-tight mt-0 mb-8 scroll-mt-20 text-foreground" {...props}>
									{children}
								</h1>
							),
							h2: ({ children, ...props }) => (
								<h2
									className="text-2xl font-semibold tracking-tight mt-16 mb-6 pb-3 border-b scroll-mt-20 text-foreground"
									{...props}
								>
									{children}
								</h2>
							),
							h3: ({ children, ...props }) => (
								<h3 className="text-xl font-semibold tracking-tight mt-12 mb-4 scroll-mt-20 text-foreground" {...props}>
									{children}
								</h3>
							),

							// Lists
							ul: ({ children, ...props }) => (
								<ul
									className="my-6 ml-6 list-disc space-y-2 [&>li]:text-muted-foreground marker:text-primary"
									{...props}
								>
									{children}
								</ul>
							),
							ol: ({ children, ...props }) => (
								<ol
									className="my-6 ml-6 list-decimal space-y-2 [&>li]:text-muted-foreground marker:text-primary"
									{...props}
								>
									{children}
								</ol>
							),

							// Tables
							table: ({ children, ...props }) => (
								<div className="my-8 w-full overflow-x-auto rounded-lg border shadow-sm">
									<table className="w-full border-collapse text-sm" {...props}>
										{children}
									</table>
								</div>
							),
							thead: ({ children, ...props }) => (
								<thead className="bg-muted/50" {...props}>
									{children}
								</thead>
							),
							th: ({ children, ...props }) => (
								<th className="border-b px-4 py-3 text-left font-semibold text-foreground" {...props}>
									{children}
								</th>
							),
							td: ({ children, ...props }) => (
								<td className="border-b px-4 py-3 text-muted-foreground" {...props}>
									{children}
								</td>
							)
						}}
					>
						{content}
					</ReactMarkdown>
				</article>
			</div>
		</div>
	);
}
