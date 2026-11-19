/**
 * The contact form: name, email and message, sent to `POST /api/contact` through the typed API client.
 *
 * It checks itself with the rules the server uses (`@raineworks/tools/contact`), never the browser's own bubbles: a
 * field says what's wrong under it once it's been left or the form was sent, the first one at fault gets focus, and a
 * fixed field clears as it's typed in. What the server refuses anyway shows above the button. Once sent, the form
 * gives way to a confirmation, with a way to send another.
 *
 * @module components/contact-form
 */

import { CONTACT_LIMITS, contactErrors, type ContactField, type ContactRequest } from '@raineworks/tools/contact';
import { Button } from '@raineworks/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@raineworks/ui/components/card';
import { Input } from '@raineworks/ui/components/input';
import { Label } from '@raineworks/ui/components/label';
import { Spinner } from '@raineworks/ui/components/spinner';
import { Textarea } from '@raineworks/ui/components/textarea';
import { api, errorMessage, unwrap } from '@raineworks/ui/lib/api';
import { cn } from '@raineworks/ui/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { AlertCircleIcon, CheckIcon, SendIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

const EMPTY: ContactRequest = { name: '', email: '', message: '' };
/** The fields in the order they're shown: the first at fault gets focus. */
const FIELDS: readonly ContactField[] = ['name', 'email', 'message'];
/** How close to the limit the message's count turns to a warning. */
const NEAR_LIMIT = 0.9;

const fieldId = (field: ContactField) => `contact-${field}`;
const errorId = (field: ContactField) => `contact-${field}-error`;

/** Sends a message. */
function useSendMessage() {
	return useMutation({
		mutationFn: (input: ContactRequest) => unwrap(api.api.contact.$post({ json: input })),
	});
}

/** A label, its control, and under it what's wrong (or a hint, or the message's count). */
function Field({
	field,
	label,
	error,
	aside,
	children,
}: {
	field: ContactField;
	label: string;
	error?: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="grid content-start gap-2">
			<Label htmlFor={fieldId(field)}>{label}</Label>
			{children}
			{(error || aside) && (
				<div className="flex items-start justify-between gap-3 text-xs">
					{error ? (
						<p id={errorId(field)} className="flex items-center gap-1.5 text-destructive">
							<AlertCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
							{error}
						</p>
					) : (
						<span />
					)}
					{aside}
				</div>
			)}
		</div>
	);
}

/** The form's card, its heading over the form or, once sent, the confirmation. */
export function ContactForm() {
	const send = useSendMessage();
	const [values, setValues] = useState<ContactRequest>(EMPTY);
	const [touched, setTouched] = useState<ReadonlySet<ContactField>>(new Set());
	const [submitted, setSubmitted] = useState(false);
	const [sentTo, setSentTo] = useState<{ name: string } | null>(null);

	const errors = contactErrors(values);
	/** A field's problem, once it's been left or the form was sent: never while someone is still typing it first. */
	const shown = (field: ContactField) => (submitted || touched.has(field) ? errors[field] : undefined);
	const update = (field: ContactField) => (event: { target: { value: string } }) =>
		setValues((current) => ({ ...current, [field]: event.target.value }));
	const leave = (field: ContactField) => () => setTouched((current) => new Set(current).add(field));
	/** What a control says about itself: required, and when it's at fault, which text says why. */
	const described = (field: ContactField) => ({
		id: fieldId(field),
		name: field,
		required: true,
		'aria-invalid': shown(field) ? true : undefined,
		'aria-describedby': shown(field) ? errorId(field) : undefined,
		value: values[field],
		onChange: update(field),
		onBlur: leave(field),
	});

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitted(true);
		const first = FIELDS.find((field) => errors[field]);
		if (first) {
			document.getElementById(fieldId(first))?.focus();
			return;
		}
		send.mutate(values, { onSuccess: () => setSentTo({ name: values.name.trim() }) });
	};
	const startOver = () => {
		setValues(EMPTY);
		setTouched(new Set());
		setSubmitted(false);
		setSentTo(null);
		send.reset();
	};

	const count = values.message.length;
	const nearLimit = count > CONTACT_LIMITS.message * NEAR_LIMIT;

	return (
		<Card className="gap-6">
			{sentTo ? (
				<CardContent className="flex flex-col items-start gap-4 py-6" role="status">
					<span
						className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success"
						aria-hidden="true"
					>
						<CheckIcon className="size-5" />
					</span>
					<div className="grid gap-1">
						<h2 className="text-lg font-semibold">Message sent</h2>
						<p className="text-sm text-muted-foreground">Thanks, {sentTo.name}. Your message went through.</p>
					</div>
					<Button variant="outline" onClick={startOver}>
						Send another message
					</Button>
				</CardContent>
			) : (
				<>
					<CardHeader>
						<CardTitle>
							<h2>Send a message</h2>
						</CardTitle>
						<CardDescription>Write here, and I’ll reply by email.</CardDescription>
					</CardHeader>
					<CardContent>
						{/* `noValidate`: the fields check themselves (above), never with the browser's own bubbles. */}
						<form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
							<div className="grid gap-5 sm:grid-cols-2">
								<Field field="name" label="Name" error={shown('name')}>
									<Input {...described('name')} maxLength={CONTACT_LIMITS.name} autoComplete="name" />
								</Field>
								<Field field="email" label="Email" error={shown('email')}>
									<Input
										{...described('email')}
										type="email"
										inputMode="email"
										maxLength={CONTACT_LIMITS.email}
										autoComplete="email"
										placeholder="you@example.com"
									/>
								</Field>
							</div>
							<Field
								field="message"
								label="Message"
								error={shown('message')}
								aside={
									<span
										aria-live="polite"
										className={cn('ml-auto font-mono text-muted-foreground tabular-nums', nearLimit && 'text-warning')}
									>
										{count.toLocaleString('en')} / {CONTACT_LIMITS.message.toLocaleString('en')}
									</span>
								}
							>
								<Textarea
									{...described('message')}
									maxLength={CONTACT_LIMITS.message}
									placeholder="What’s on your mind?"
									className="min-h-40 resize-y"
								/>
							</Field>
							{send.isError && (
								<p
									role="alert"
									className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
								>
									<AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
									{errorMessage(send.error)}
								</p>
							)}
							<Button type="submit" size="lg" disabled={send.isPending} className="w-full sm:w-auto sm:self-end">
								{send.isPending ? <Spinner /> : <SendIcon />}
								{send.isPending ? 'Sending…' : 'Send message'}
							</Button>
						</form>
					</CardContent>
				</>
			)}
		</Card>
	);
}
