import { useEffect, useState } from 'react';

export interface TerminalPromptProps {
	/** Command text typed after the prompt, e.g. "whoami". */
	command: string;
	/** Lines printed as "output" once typing completes. */
	output?: string[];
	/** Typing speed in ms per character. */
	speedMs?: number;
}

/**
 * Renders a fake shell prompt that types out a command, then reveals output lines.
 * Pure CSS/JS — no canvas, no animation library.
 */
export function TerminalPrompt({ command, output = [], speedMs = 45 }: TerminalPromptProps) {
	const [typed, setTyped] = useState('');
	const [done, setDone] = useState(false);

	useEffect(() => {
		setTyped('');
		setDone(false);
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setTyped(command.slice(0, i));
			if (i >= command.length) {
				clearInterval(id);
				setDone(true);
			}
		}, speedMs);
		return () => clearInterval(id);
	}, [command, speedMs]);

	return (
		<div className="font-mono text-sm sm:text-base">
			<div className="flex items-center gap-2">
				<span className="text-accent">raine@raineworks</span>
				<span className="text-text-dim">:~$</span>
				<span>{typed}</span>
				<span className={done ? 'animate-caret' : ''}>▌</span>
			</div>
			{done && (
				<div className="mt-2 flex flex-col gap-1 text-text-dim">
					{output.map((line) => (
						<div key={line}>{line}</div>
					))}
				</div>
			)}
		</div>
	);
}
