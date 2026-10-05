import { type FormEvent, useState } from 'react';
import { CoffeeButton } from '@/components/CoffeeButton';
import { profile } from '@/content/profile';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FIELD_CLASS =
	'w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent';

function ContactForm() {
	const [status, setStatus] = useState<Status>('idle');

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		setStatus('sending');
		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(Object.fromEntries(new FormData(form))),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			form.reset();
			setStatus('sent');
		} catch {
			setStatus('error');
		}
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-3">
			<label className="flex flex-col gap-1 text-text-dim text-sm">
				name
				<input name="name" type="text" required maxLength={200} autoComplete="name" className={FIELD_CLASS} />
			</label>
			<label className="flex flex-col gap-1 text-text-dim text-sm">
				email
				<input name="email" type="email" required maxLength={320} autoComplete="email" className={FIELD_CLASS} />
			</label>
			<label className="flex flex-col gap-1 text-text-dim text-sm">
				message
				<textarea name="message" required maxLength={5000} rows={6} className={FIELD_CLASS} />
			</label>
			<div className="flex items-center gap-4">
				<button
					type="submit"
					disabled={status === 'sending'}
					className="border border-accent px-4 py-2 text-accent text-sm hover:bg-accent-dim disabled:opacity-50"
				>
					{status === 'sending' ? './sending...' : './send'}
				</button>
				{status === 'sent' && <span className="text-accent text-sm">message sent</span>}
				{status === 'error' && <span className="text-highlight text-sm">something went wrong, try again</span>}
			</div>
		</form>
	);
}

export function ContactPage() {
	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-accent"># contact</h1>
			<div className="flex flex-col gap-2 text-sm">
				<a href={`mailto:${profile.contact.email}`} className="text-text-dim hover:text-accent">
					email: <span className="text-text">{profile.contact.email}</span>
				</a>
				<a href={profile.contact.github} className="text-text-dim hover:text-accent">
					github: <span className="text-text">{profile.contact.github}</span>
				</a>
				<a href={profile.contact.linkedin} className="text-text-dim hover:text-accent">
					linkedin: <span className="text-text">{profile.contact.linkedin}</span>
				</a>
			</div>
			<ContactForm />
			<div className="pt-2">
				<CoffeeButton />
			</div>
		</div>
	);
}
