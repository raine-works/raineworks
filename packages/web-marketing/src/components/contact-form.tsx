/**
 * The contact form: name, email and message, sent to `POST /api/contact` through the typed API client. The fields
 * carry the server's limits; what the server refuses is shown under the form (`errorMessage`), and a sent message is
 * confirmed with a toast and the form cleared.
 *
 * @module components/contact-form
 */

import { Button } from '@raineworks/ui/components/button';
import { Input } from '@raineworks/ui/components/input';
import { Label } from '@raineworks/ui/components/label';
import { Textarea } from '@raineworks/ui/components/textarea';
import { api, errorMessage, unwrap } from '@raineworks/ui/lib/api';
import { Section } from '@raineworks/web-marketing/components/section';
import { useMutation } from '@tanstack/react-query';
import { SendIcon } from 'lucide-react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

/** What the form sends. */
interface ContactInput {
	name: string;
	email: string;
	message: string;
}

/** Sends a message; the caller clears the form once it's sent. */
function useSendMessage() {
	return useMutation({
		mutationFn: (input: ContactInput) => unwrap(api.api.contact.$post({ json: input })),
	});
}

export function ContactForm() {
	const send = useSendMessage();
	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		const input = {
			name: String(data.get('name') ?? ''),
			email: String(data.get('email') ?? ''),
			message: String(data.get('message') ?? ''),
		};
		send.mutate(input, {
			onSuccess: () => {
				form.reset();
				toast.success('Message sent', { description: 'Thanks — I’ll get back to you by email.' });
			},
		});
	};
	return (
		<Section title="Send a message" description="Or write here, and I’ll reply by email.">
			<form onSubmit={onSubmit} className="flex flex-col gap-5">
				<div className="grid gap-5 sm:grid-cols-2">
					<div className="grid gap-2">
						<Label htmlFor="contact-name">Name</Label>
						<Input id="contact-name" name="name" required maxLength={200} autoComplete="name" />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="contact-email">Email</Label>
						<Input id="contact-email" name="email" type="email" required maxLength={320} autoComplete="email" />
					</div>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="contact-message">Message</Label>
					<Textarea id="contact-message" name="message" required maxLength={5000} rows={6} />
				</div>
				{send.isError && (
					<p role="alert" className="text-sm text-destructive">
						{errorMessage(send.error)}
					</p>
				)}
				<Button type="submit" disabled={send.isPending} className="self-start">
					<SendIcon />
					{send.isPending ? 'Sending…' : 'Send message'}
				</Button>
			</form>
		</Section>
	);
}
