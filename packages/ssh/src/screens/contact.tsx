/**
 * Contact: the links, and a form that sends a message through the site's API (`POST /api/contact`), checked first
 * with the rules the site and the API use (`@raineworks/tools/contact`).
 *
 * Press enter (or `i`, or click a field) to start typing: the form then has the keys. Tab and shift-tab move between
 * fields, ⌃S sends, esc leaves the form. What's wrong shows under each field once you've tried to send.
 *
 * @module screens/contact
 */

import type { TextareaRenderable } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { sanitize } from '@raineworks/ssh/sanitize';
import { theme } from '@raineworks/ssh/theme';
import { Card, Heading } from '@raineworks/ssh/ui/panel';
import type { Mode } from '@raineworks/ssh/ui/screens';
import { CONTACT_LIMITS, contactErrors, type ContactField, type ContactRequest } from '@raineworks/tools/contact';
import { profile } from '@raineworks/web-marketing/content/profile';
import { useRef, useState } from 'react';

/** Sends a message, saying what went wrong if it didn't go. */
export type SendMessage = (input: ContactRequest) => Promise<{ ok: true } | { ok: false; message: string }>;

const FIELDS: readonly ContactField[] = ['name', 'email', 'message'];
const LABELS: Record<ContactField, string> = { name: 'Name', email: 'Email', message: 'Message' };
const EMPTY: ContactRequest = { name: '', email: '', message: '' };

type Status =
	{ kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; name: string } | { kind: 'failed'; message: string };

export function Contact({
	mode,
	onMode,
	send,
	width,
}: {
	mode: Mode;
	onMode: (mode: Mode) => void;
	send: SendMessage;
	width: number;
}) {
	const [values, setValues] = useState<ContactRequest>(EMPTY);
	const [focus, setFocus] = useState(0);
	const [tried, setTried] = useState(false);
	const [status, setStatus] = useState<Status>({ kind: 'idle' });
	const message = useRef<TextareaRenderable>(null);
	const typing = mode === 'form';
	const errors = contactErrors(values);

	const submit = async () => {
		setTried(true);
		const first = FIELDS.findIndex((field) => errors[field]);
		if (first !== -1) {
			setFocus(first);
			return;
		}
		setStatus({ kind: 'sending' });
		const result = await send(values);
		if (!result.ok) {
			setStatus({ kind: 'failed', message: result.message });
			return;
		}
		setStatus({ kind: 'sent', name: values.name.trim() });
		setValues(EMPTY);
		setTried(false);
		setFocus(0);
		message.current?.clear();
		onMode('nav');
	};

	useKeyboard((key) => {
		if (!typing) return;
		if (key.name === 'escape') onMode('nav');
		else if (key.name === 'tab') setFocus((current) => (current + (key.shift ? FIELDS.length - 1 : 1)) % FIELDS.length);
		else if (key.ctrl && key.name === 's' && status.kind !== 'sending') void submit();
	});

	const field = (name: ContactField, i: number, control: React.ReactNode) => {
		const focused = typing && focus === i;
		const error = tried ? errors[name] : undefined;
		return (
			<box
				key={name}
				onMouseDown={() => {
					onMode('form');
					setFocus(i);
				}}
				style={{ flexDirection: 'column', marginBottom: 1 }}
			>
				<text>
					<span fg={focused ? theme.accent : theme.muted}>{LABELS[name]}</span>
					{name === 'message' && (
						<span fg={values.message.length > CONTACT_LIMITS.message * 0.9 ? theme.warning : theme.faint}>
							{`  ${values.message.length.toLocaleString('en')} / ${CONTACT_LIMITS.message.toLocaleString('en')}`}
						</span>
					)}
				</text>
				<box
					style={{
						border: true,
						borderStyle: 'rounded',
						borderColor: error ? theme.danger : focused ? theme.accent : theme.border,
						height: name === 'message' ? 7 : 3,
						paddingLeft: 1,
					}}
				>
					{control}
				</box>
				{error && <text fg={theme.danger}>{`✖ ${error}`}</text>}
			</box>
		);
	};

	const inputStyle = {
		backgroundColor: theme.bg,
		focusedBackgroundColor: theme.bg,
		textColor: theme.text,
		flexGrow: 1,
	};
	const wide = width >= 90;
	return (
		<box style={{ flexDirection: 'column', padding: 1, paddingLeft: 2 }}>
			<Heading eyebrow="contact" title="Get in touch" />
			<box style={{ flexDirection: wide ? 'row' : 'column', gap: 2 }}>
				<box style={{ flexDirection: 'column', width: wide ? 34 : undefined }}>
					<Card title="links">
						{[
							['email', profile.contact.email, `mailto:${profile.contact.email}`],
							['github', 'raine-works', profile.contact.github],
							['linkedin', 'rainepetersen', profile.contact.linkedin],
							['x', '@raineworks', profile.contact.x],
						].map(([label, value, href]) => (
							<text key={label}>
								<span fg={theme.dim}>{(label ?? '').padEnd(10)}</span>
								<a href={href ?? ''} fg={theme.accent}>
									{sanitize(value ?? '')}
								</a>
							</text>
						))}
					</Card>
				</box>
				<box style={{ flexDirection: 'column', flexGrow: 1 }}>
					<Card title={typing ? 'send a message · typing' : 'send a message · press enter'} accent={typing} grow>
						<box style={{ height: 1 }} />
						{field(
							'name',
							0,
							<input
								focused={typing && focus === 0}
								value={values.name}
								maxLength={CONTACT_LIMITS.name}
								placeholder="Ada Lovelace"
								onInput={(name: string) => setValues((current) => ({ ...current, name }))}
								style={inputStyle}
							/>,
						)}
						{field(
							'email',
							1,
							<input
								focused={typing && focus === 1}
								value={values.email}
								maxLength={CONTACT_LIMITS.email}
								placeholder="you@example.com"
								onInput={(email: string) => setValues((current) => ({ ...current, email }))}
								style={inputStyle}
							/>,
						)}
						{field(
							'message',
							2,
							<textarea
								ref={message}
								focused={typing && focus === 2}
								placeholder="What’s on your mind?"
								onContentChange={() =>
									setValues((current) => ({ ...current, message: message.current?.plainText ?? current.message }))
								}
								style={inputStyle}
							/>,
						)}
						<text>
							{status.kind === 'sending' && <span fg={theme.accent}>◌ Sending…</span>}
							{status.kind === 'sent' && (
								<span fg={theme.success}>{`✔ Message sent. Thanks, ${sanitize(status.name)}.`}</span>
							)}
							{status.kind === 'failed' && <span fg={theme.danger}>{`✖ ${sanitize(status.message)}`}</span>}
							{status.kind === 'idle' && (
								<span fg={theme.faint}>
									{typing ? 'tab next field · ⌃S send · esc leave' : 'enter to start typing'}
								</span>
							)}
						</text>
						<box style={{ height: 1 }} />
					</Card>
				</box>
			</box>
		</box>
	);
}
