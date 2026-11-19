/**
 * About: what this is, how it's made, the version, and the licences: the site's own (MIT) and what this app ships
 * with, OpenTUI's native library among them, which carries FFmpeg under the LGPL (its text and where its source is
 * are in the image, `/app/licenses`).
 *
 * @module screens/about
 */

import { theme } from '@raineworks/ssh/theme';
import { Logo } from '@raineworks/ssh/ui/logo';
import { Card, Heading } from '@raineworks/ssh/ui/panel';

const STACK: Array<[string, string, string]> = [
	['OpenTUI', 'the terminal renderer: layout, colour, mouse', 'MIT; its native library LGPL-2.1+ (FFmpeg)'],
	['React', 'the components', 'MIT'],
	['ssh2', 'the SSH server', 'MIT'],
	['Bun', 'the runtime', 'MIT'],
];

export function About({ version, width, height }: { version: string; width: number; height: number }) {
	return (
		<box style={{ flexDirection: 'column', padding: 1, paddingLeft: 2 }}>
			<box style={{ flexDirection: 'row', gap: 3 }}>
				{width >= 100 && <Logo cols={32} />}
				<box style={{ flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
					<Heading eyebrow="about" title="raineworks, in your terminal" />
					<text fg={theme.muted} wrapMode="word">
						The site, as a terminal app you reach over SSH: no account, no shell, just the pages. It runs the same
						content as raineworks.com and sends messages through the same API. The mark beside this is the logo’s own
						geometry, drawn in braille.
					</text>
				</box>
			</box>
			<box style={{ height: 1 }} />
			<Card title="this session">
				<text>
					<span fg={theme.dim}>{'version   '}</span>
					<span fg={theme.text}>{version}</span>
				</text>
				<text>
					<span fg={theme.dim}>{'terminal  '}</span>
					<span fg={theme.text}>{`${width}×${height}`}</span>
				</text>
				<text>
					<span fg={theme.dim}>{'source    '}</span>
					<a href="https://github.com/raine-works/raineworks" fg={theme.accent}>
						github.com/raine-works/raineworks
					</a>
				</text>
			</Card>
			<box style={{ height: 1 }} />
			<Card title="built with">
				{STACK.map(([name, what, license]) => (
					<text key={name}>
						<strong fg={theme.text}>{name.padEnd(9)}</strong>
						<span fg={theme.muted}>{what.padEnd(46)}</span>
						<span fg={theme.dim}>{license}</span>
					</text>
				))}
			</Card>
			<box style={{ height: 1 }} />
			<Card title="licences">
				<text fg={theme.muted} wrapMode="word">
					raineworks is open source under the MIT License, © Raine Petersen. OpenTUI’s native library includes a
					decode-only FFmpeg under the GNU LGPL 2.1 or later: its licence text and where to get its source ship with
					this app (/app/licenses), and the library is a separate file you may replace.
				</text>
				<text>
					<a href="https://ffmpeg.org/legal.html" fg={theme.accent}>
						ffmpeg.org/legal.html
					</a>
				</text>
			</Card>
		</box>
	);
}
