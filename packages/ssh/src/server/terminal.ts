import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

/** Minimal TTY-like stdout for Ink, backed by an SSH channel. */
export class TerminalOutput extends Writable {
	readonly isTTY = true;
	columns: number;
	rows: number;

	constructor(
		private readonly sink: { write(data: string | Buffer): unknown },
		columns: number,
		rows: number,
	) {
		super();
		this.columns = columns;
		this.rows = rows;
	}

	override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: (error?: Error | null) => void) {
		// Terminals expect CRLF; Ink emits bare LF.
		const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
		this.sink.write(text.replace(/\r?\n/g, '\r\n'));
		cb();
	}

	resize(columns: number, rows: number) {
		this.columns = columns;
		this.rows = rows;
		this.emit('resize');
	}
}

/** Minimal TTY-like stdin for Ink; the SSH channel pushes keystrokes into it. */
export class TerminalInput extends Readable {
	readonly isTTY = true;
	readonly events = new EventEmitter();

	override _read() {}
	setRawMode(_mode: boolean) {
		return this;
	}
	override setEncoding(_enc: BufferEncoding) {
		return this;
	}
	ref() {
		return this;
	}
	unref() {
		return this;
	}
}
