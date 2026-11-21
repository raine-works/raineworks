import { cn } from '@raineworks/ui/lib/utils';
import type * as React from 'react';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card"
			className={cn(
				// The accent, faint, in its border (`gradient-border`, globals.css): full where a state sets --gradient-border-mix.
				'gradient-border relative flex flex-col gap-4 rounded-xl border bg-card py-5 text-card-foreground shadow-sm',
				// A card that opens (no title above) or ends (no footer below) with a table: the table is its edge.
				'has-[>[data-slot=card-content]:first-child>[data-slot=table-container]:first-child]:pt-0',
				'has-[>[data-slot=card-content]:last-child>[data-slot=table-container]:last-child]:pb-0',
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				'@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5',
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="card-title" className={cn('leading-none font-semibold', className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-action"
			className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-content"
			className={cn(
				'px-5',
				// A table straight in it runs to the card's edges, its first and last columns lined up with the title.
				'*:data-[slot=table-container]:-mx-5 *:data-[slot=table-container]:w-auto',
				'[&>[data-slot=table-container]:first-child]:rounded-t-xl [&>[data-slot=table-container]:last-child]:rounded-b-xl',
				'[&>[data-slot=table-container]_:is(th,td):first-child]:pl-5 [&>[data-slot=table-container]_:is(th,td):last-child]:pr-5',
				className,
			)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div data-slot="card-footer" className={cn('flex items-center px-5 [.border-t]:pt-5', className)} {...props} />
	);
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
