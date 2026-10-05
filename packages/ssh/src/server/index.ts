import { readFileSync } from 'node:fs';
import { render } from 'ink';
import { createElement } from 'react';
import { Server } from 'ssh2';
import { App } from '@/App';
import { ConnectionGuard, clampSize, defaultLimits, type Limits } from '@/server/limits';
import { TerminalInput, TerminalOutput } from '@/server/terminal';

export type ServerOptions = {
	hostKey: string | Buffer;
	port: number;
	limits?: Partial<Limits>;
};

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
				session.on('window-change', (acceptWc, _reject, size) => {
					acceptWc?.();
					columns = clampSize(size.cols, limits.maxColumns, columns);
					rows = clampSize(size.rows, limits.maxRows, rows);
					output?.resize(columns, rows);
				});

				session.on('shell', (acceptShell, rejectShell) => {
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

					const app = render(createElement(App), {
						stdin: input as never,
						stdout: output as never,
						exitOnCtrlC: false,
					});
					cleanup = () => {
						clearTimeout(idle);
						app.unmount();
					};
					void app.waitUntilExit().then(() => {
						channel.exit(0);
						channel.end();
						client.end();
					});
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

export function loadHostKey(path: string): Buffer {
	return readFileSync(path);
}
