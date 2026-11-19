'use client';

import { Button } from '@raineworks/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@raineworks/ui/components/tabs';
import { useModalHistory } from '@raineworks/ui/lib/modal-history';
import { cn } from '@raineworks/ui/lib/utils';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type * as React from 'react';

/** Open, it's in history: Back closes it (`lib/modal-history`). */
function Dialog({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return (
		<DialogPrimitive.Root data-slot="dialog" {...props} {...useModalHistory({ open, defaultOpen, onOpenChange })} />
	);
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			className={cn(
				'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
				className,
			)}
			{...props}
		/>
	);
}

/**
 * How wide a dialog is from `sm` up (on phones every dialog is full screen), by what it holds:
 *
 * - `sm` (28rem): one field, a code, a secret shown once, "it's ready".
 * - `md` (40rem, the default): a short form.
 * - `lg` (64rem, a fixed 85% of the screen's height, so it never jumps as its content changes): an editor or a detail
 *   view with a lot in it, laid out in `DialogSection`s or a split `DialogBody`.
 * - `xl` (the screen, less a margin): something to work in: a document, a delivery's payload.
 * - `full` (the whole screen, edge to edge): a presentation.
 *
 * Never widen one with `sm:max-w-*` (`lint-classes` refuses it): pick its size.
 */
const SIZES = {
	sm: 'sm:max-w-md sm:max-h-[calc(100dvh-4rem)]',
	md: 'sm:max-w-160 sm:max-h-[calc(100dvh-4rem)]',
	lg: 'sm:max-w-5xl sm:h-[min(85dvh,60rem)]',
	xl: 'sm:max-w-[100rem] sm:w-[calc(100vw-3rem)] sm:h-[calc(100dvh-3rem)]',
	full: 'sm:inset-0 sm:top-0 sm:left-0 sm:h-dvh sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-0',
} as const;

export type DialogSize = keyof typeof SIZES;

/**
 * A dialog in three parts, each a direct child (a wrapping `<form>` or `Tabs` takes `className="contents"`, or
 * `flex min-h-0 flex-1 flex-col`): a `DialogHeader` (eyebrow, title, subtitle, its actions and the close button) and
 * a `DialogFooter` (actions) that stay put, and a `DialogBody` between them that scrolls. The dialog itself never
 * scrolls. Full screen on phones; centred from `sm` up at its `size`.
 */
function DialogContent({
	className,
	children,
	size = 'md',
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { size?: DialogSize }) {
	return (
		<DialogPortal data-slot="dialog-portal">
			<DialogOverlay />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				data-size={size}
				className={cn(
					'group/dialog fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-background shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
					'sm:inset-auto sm:top-[50%] sm:left-[50%] sm:h-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border',
					SIZES[size],
					className,
				)}
				{...props}
			>
				{children}
			</DialogPrimitive.Content>
		</DialogPortal>
	);
}

/**
 * The dialog's title bar. Never scrolls; a shadow shows under it once its body has. Its children are the title and
 * subtitle (`DialogTitle`, `DialogDescription`) and anything that belongs with them (a status badge); `eyebrow` is a
 * small line above the title saying what it's part of ("Widgets · Blue widget"); `actions` sit beside the close
 * button (a PDF, "Send a test"); `tabs` (a `TabsList`) run under it all, the body's `TabsContent` scrolling under them.
 */
function DialogHeader({
	className,
	children,
	eyebrow,
	actions,
	tabs,
	showCloseButton = true,
	...props
}: React.ComponentProps<'div'> & {
	eyebrow?: React.ReactNode;
	actions?: React.ReactNode;
	tabs?: React.ReactNode;
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-header"
			className={cn(
				'relative z-10 shrink-0 border-b bg-background transition-shadow group-data-scrolled/dialog:shadow-md',
				className,
			)}
			{...props}
		>
			<div className="flex items-start gap-3 px-4 pt-4 pb-4 sm:px-6">
				<div className="grid min-w-0 flex-1 gap-1.5 pt-1">
					{eyebrow && (
						<p className="truncate text-xs font-medium tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
					)}
					{children}
				</div>
				{(actions || showCloseButton) && (
					<div className="flex shrink-0 items-center gap-2">
						{actions}
						{showCloseButton && <DialogCloseButton />}
					</div>
				)}
			</div>
			{/* Scrolls sideways when the tabs don't fit, and only sideways: the open tab's underline hangs below the list,
			    which would otherwise make the strip scroll up and down too (a scroll bar beside the tabs). */}
			{tabs && <div className="-mb-px overflow-x-auto overflow-y-hidden px-4 pb-0.5 sm:px-6">{tabs}</div>}
		</div>
	);
}

/**
 * The header's close button: a real button (44px on phones). No tooltip: a dialog focuses it as it opens, which would
 * show one every time.
 */
function DialogCloseButton() {
	return (
		<DialogPrimitive.Close asChild>
			<Button
				data-slot="dialog-close"
				variant="ghost"
				size="icon"
				aria-label="Close"
				className="size-11 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:size-9 [&_svg:not([class*='size-'])]:size-5"
			>
				<XIcon />
			</Button>
		</DialogPrimitive.Close>
	);
}

/** Marks the dialog `data-scrolled` while its body is scrolled down, for the header's shadow. */
function markScrolled(event: React.UIEvent<HTMLDivElement>) {
	const dialog = event.currentTarget.closest('[data-slot=dialog-content]');
	dialog?.toggleAttribute('data-scrolled', event.currentTarget.scrollTop > 0);
}

/**
 * What the dialog is about, between its header and footer: the only part that scrolls. `split` (for `lg` and `xl`)
 * gives it a `DialogAside` on the right once it's wide enough (a summary, a preview, help), which stays in view while
 * the rest scrolls; before that the aside follows the rest. `className` is the scrolling frame's (its padding);
 * `contentClassName` the grid inside it (its gaps). The grid is a wrapper because a container query never styles its
 * own container.
 */
function DialogBody({
	className,
	contentClassName,
	layout = 'stack',
	onScroll,
	children,
	...props
}: React.ComponentProps<'div'> & { layout?: 'stack' | 'split'; contentClassName?: string }) {
	return (
		<div
			data-slot="dialog-body"
			data-layout={layout}
			onScroll={(event) => {
				markScrolled(event);
				onScroll?.(event);
			}}
			className={cn(
				'@container/dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6',
				className,
			)}
			{...props}
		>
			<div
				data-slot="dialog-body-content"
				className={cn(
					'grid min-w-0 content-start gap-6',
					layout === 'split' && '@3xl/dialog-body:grid-cols-[minmax(0,1fr)_20rem] @3xl/dialog-body:gap-8',
					contentClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

/**
 * The main column of a split `DialogBody`. Put several sections in one, so they stack beside the aside rather than
 * flowing around it.
 */
function DialogMain({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="dialog-main" className={cn('grid min-w-0 content-start gap-6', className)} {...props} />;
}

/** The side column of a split `DialogBody`: muted, and held in view while the main column scrolls. */
function DialogAside({ className, ...props }: React.ComponentProps<'aside'>) {
	return (
		<aside
			data-slot="dialog-aside"
			className={cn(
				'grid min-w-0 content-start gap-4 rounded-lg border bg-muted/40 p-4 text-sm',
				'@3xl/dialog-body:sticky @3xl/dialog-body:top-0 @3xl/dialog-body:self-start',
				className,
			)}
			{...props}
		/>
	);
}

/**
 * A titled part of a long dialog, divided from the one before. Once the body is wide enough (an `lg` or `xl` dialog)
 * its title and description sit in a column on the left, beside what it holds, like a page's `Section layout="form"`.
 */
function DialogSection({
	title,
	description,
	actions,
	className,
	children,
	...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
	title: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<section
			data-slot="dialog-section"
			className={cn(
				'grid gap-4 border-t pt-6 first:border-t-0 first:pt-0',
				'@3xl/dialog-body:grid-cols-[14rem_minmax(0,1fr)] @3xl/dialog-body:gap-x-8',
				className,
			)}
			{...props}
		>
			<div className="flex items-start justify-between gap-3 @3xl/dialog-body:flex-col">
				<div className="grid gap-1">
					<h3 className="text-sm leading-snug font-semibold">{title}</h3>
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</div>
				{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
			</div>
			<div className="grid min-w-0 content-start gap-4">{children}</div>
		</section>
	);
}

/**
 * The dialog's actions. Never scrolls. `start` holds what sits apart on the left (a "Remove", what's unsaved); the
 * rest is right-aligned, the main action last.
 */
function DialogFooter({
	className,
	showCloseButton = false,
	start,
	children,
	...props
}: React.ComponentProps<'div'> & {
	showCloseButton?: boolean;
	start?: React.ReactNode;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				'flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-4',
				className,
			)}
			{...props}
		>
			{start && (
				<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:mr-auto">{start}</div>
			)}
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close asChild>
					<Button variant="outline">Close</Button>
				</DialogPrimitive.Close>
			)}
		</div>
	);
}

/**
 * A dialog split into tabs (an `lg` or `xl` editor with several areas): wrap its header and body in it, pass
 * `DialogTabsList` to the header's `tabs`, and put each area in a `DialogTab` inside the body, which scrolls under
 * them. Only the open tab is mounted.
 *
 * ```tsx
 * <DialogTabs value={tab} onValueChange={setTab}>
 *   <DialogHeader tabs={<DialogTabsList tabs={[{ value: 'details', label: 'Details' }, …]} />}>…</DialogHeader>
 *   <DialogBody><DialogTab value="details">…</DialogTab>…</DialogBody>
 * </DialogTabs>
 * ```
 */
function DialogTabs({ className, ...props }: React.ComponentProps<typeof Tabs>) {
	return <Tabs className={cn('flex min-h-0 flex-1 flex-col gap-0', className)} {...props} />;
}

export interface DialogTabItem {
	value: string;
	label: React.ReactNode;
	/** A dot: something in it needs a look (a problem from a save). */
	attention?: boolean;
	hidden?: boolean;
}

/** The tabs under a dialog's title, underlined like a page's (`PageTabs`). */
function DialogTabsList({ tabs }: { tabs: readonly DialogTabItem[] }) {
	return (
		<TabsList variant="line" className="justify-start group-data-[orientation=horizontal]/tabs:h-auto">
			{tabs
				.filter((tab) => !tab.hidden)
				.map((tab) => (
					<TabsTrigger
						key={tab.value}
						value={tab.value}
						className="h-9 flex-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none"
					>
						{tab.label}
						{tab.attention && (
							<span className="size-2 rounded-full bg-destructive">
								<span className="sr-only"> (needs attention)</span>
							</span>
						)}
					</TabsTrigger>
				))}
		</TabsList>
	);
}

/** One tab's content, in the dialog's body. */
function DialogTab({ className, ...props }: React.ComponentProps<typeof TabsContent>) {
	return <TabsContent className={cn('grid min-w-0 content-start gap-6', className)} {...props} />;
}

/** The dialog's name: larger in `lg` and `xl` dialogs. */
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn(
				'text-lg leading-tight font-semibold text-pretty group-data-[size=full]/dialog:text-xl group-data-[size=lg]/dialog:text-xl group-data-[size=xl]/dialog:text-xl md:group-data-[size=full]/dialog:text-2xl',
				className,
			)}
			{...props}
		/>
	);
}

/** The subtitle: what the dialog does, or what it's about. */
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn('text-sm text-pretty text-muted-foreground', className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogAside,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogMain,
	DialogOverlay,
	DialogPortal,
	DialogSection,
	DialogTab,
	DialogTabs,
	DialogTabsList,
	DialogTitle,
	DialogTrigger,
};
