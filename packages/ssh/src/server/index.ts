/**
 * The SSH server (`ssh2`): `none` auth only, one pty `shell` session per connection running the TUI (`app`) over the
 * channel, drawn by its own OpenTUI renderer: the session's size, resized on `window-change`, with the mouse on and
 * OpenTUI's console capture off (the process's logs stay the server's). Exec, subsystems, forwarding and shells without a pty are refused. `loadHostKey` reads the host key from
 * `SSH_HOST_KEY` (PEM text, `\n` escapes allowed) or the file at `SSH_HOST_KEY_PATH` (`DEFAULT_HOST_KEY_PATH` when
 * unset); never generated or baked in.
 *
 * @module server/index
 */

import { readFileSync } from 'node:fs';

import { type CliRenderer, createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App, type SendMessage } from '@raineworks/ssh/app';
import { clampSize, ConnectionGuard, defaultLimits, type Limits } from '@raineworks/ssh/server/limits';
import { TerminalInput, TerminalOutput } from '@raineworks/ssh/server/terminal';
import { createElement } from 'react';
import { Server, utils } from 'ssh2';
import '@raineworks/tools/prototypes';

export type ServerOptions = {
	hostKey: string | Buffer;
	port: number;
	limits?: Partial<Limits>;
	/** The version the About screen and status bar show. */
	version: string;
	/** A message sender for each new session (`server/messages`). */
	sender: () => SendMessage;
};

/** Frames a second a session draws at most: smooth rain, without one visitor costing the server much. */
const TARGET_FPS = 30;

export function createServer(options: ServerOptions) {
	const limits: Limits = { ...defaultLimits, ...options.limits };
	const guard = new ConnectionGuard(limits);
	const sweeper = setInterval(() => guard.sweep(), limits.rateWindowMs);
	sweeper.unref();

	const server = new Server({ hostKeys: [options.hostKey], ident: 'SSH-2.0-raineworks' }, (client, info) => {
		const release = guard.admit(info.ip);
		if (!release) {
			client.end();
			return;
		}

		let cleanup: (() => void) | undefined;
		const handshake = setTimeout(() => client.end(), limits.handshakeTimeoutMs);
		client.on('close', () => {
			clearTimeout(handshake);
			cleanup?.();
			release();
		});
		client.on('error', () => client.end());

		// Public, read-only site: no credentials. Only 'none' auth is accepted.
		client.on('authentication', (ctx) => {
			if (ctx.method === 'none') ctx.accept();
			else ctx.reject(['none']);
		});

		client.on('ready', () => {
			// `handshake` keeps running until a shell starts, so an authenticated
			// client cannot hold a slot by never opening one.
			// No handlers for tcpip, forwarding, exec, subsystem, env, x11 or agent:
			// ssh2 rejects any request type that has no listener.
			client.on('session', (accept) => {
				const session = accept();
				let columns = 80;
				let rows = 24;
				let wantsPty = false;

				session.on('pty', (acceptPty, _reject, ptyInfo) => {
					wantsPty = true;
					columns = clampSize(ptyInfo.cols, limits.maxColumns, 80);
					rows = clampSize(ptyInfo.rows, limits.maxRows, 24);
					acceptPty();
				});

				let output: TerminalOutput | undefined;
				let renderer: CliRenderer | undefined;
				session.on('window-change', (acceptWc, _reject, size) => {
					acceptWc?.();
					columns = clampSize(size.cols, limits.maxColumns, columns);
					rows = clampSize(size.rows, limits.maxRows, rows);
					output?.resize(columns, rows);
					renderer?.resize(columns, rows);
				});

				session.on('shell', async (acceptShell, rejectShell) => {
					if (!wantsPty || cleanup) {
						rejectShell();
						return;
					}
					clearTimeout(handshake);
					const channel = acceptShell();
					const input = new TerminalInput();
					output = new TerminalOutput(channel, columns, rows);

					let idle: ReturnType<typeof setTimeout>;
					const resetIdle = () => {
						clearTimeout(idle);
						idle = setTimeout(() => {
							channel.write('\r\nidle timeout\r\n');
							client.end();
						}, limits.idleTimeoutMs);
					};
					resetIdle();
					channel.on('data', (data: Buffer) => {
						resetIdle();
						input.push(data);
					});

					let ended = false;
					const end = () => {
						if (ended) return;
						ended = true;
						clearTimeout(idle);
						renderer?.destroy();
					};
					cleanup = end;
					const quit = async () => {
						end();
						// Back to the visitor's own screen (and cursor) before the channel closes.
						await renderer?.closed.catch(() => undefined);
						channel.exit(0);
						channel.end();
						client.end();
					};

					const { data: created, error } = await createCliRenderer({
						stdin: input as never,
						stdout: output as never,
						width: columns,
						height: rows,
						remote: true,
						exitOnCtrlC: false,
						exitSignals: [],
						useMouse: true,
						consoleMode: 'disabled',
						targetFps: TARGET_FPS,
						clearOnShutdown: true,
					}).tryCatch();
					if (error || !created || ended) {
						if (error) console.error('ssh: could not start a session', error);
						created?.destroy();
						channel.write('\r\nSorry: the app couldn’t start. Try again in a moment.\r\n');
						void quit();
						return;
					}
					renderer = created;
					createRoot(renderer).render(
						createElement(App, { version: options.version, send: options.sender(), onQuit: () => void quit() }),
					);
				});
			});
		});
	});

	server.on('close', () => clearInterval(sweeper));
	return {
		listen: () => new Promise<void>((resolve) => server.listen(options.port, '0.0.0.0', resolve)),
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
		server,
	};
}

/** Where the host key file is read from when `SSH_HOST_KEY_PATH` isn't set: the usual secret mount. */
export const DEFAULT_HOST_KEY_PATH = '/run/secrets/ssh_host_key';

/**
 * Resolves the host key from `SSH_HOST_KEY` (PEM text; literal `\n` sequences are
 * accepted for platforms that store secrets on one line) or, failing that, the
 * file at `SSH_HOST_KEY_PATH`. Throws a descriptive error instead of dumping a stack.
 */
export function loadHostKey(env: Record<string, string | undefined>): Buffer {
	// .env-style stores may keep the surrounding quotes literally.
	const inline = env.SSH_HOST_KEY?.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
	let key: Buffer;
	if (inline) {
		key = Buffer.from(inline.replace(/\\n/g, '\n'));
	} else {
		const path = env.SSH_HOST_KEY_PATH || DEFAULT_HOST_KEY_PATH;
		try {
			key = readFileSync(path);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			throw new Error(
				`no host key: set SSH_HOST_KEY (PEM text) or mount a key at SSH_HOST_KEY_PATH (${path}: ${code ?? error})`,
			);
		}
	}
	const parsed = utils.parseKey(key);
	if (parsed instanceof Error) throw new Error(`host key is not a valid private key: ${parsed.message}`);
	if (Array.isArray(parsed) ? parsed[0]?.isPrivateKey() === false : !parsed.isPrivateKey()) {
		throw new Error('host key must be a private key');
	}
	return key;
}
