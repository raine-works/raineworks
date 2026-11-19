/**
 * The top bar: the mark and name, where you are, and a live clock with the session's size.
 *
 * @module ui/header
 */

import { theme } from '@raineworks/ssh/theme';
import { useEffect, useState } from 'react';

/** The time, `HH:MM:SS UTC` (a visitor's timezone isn't something SSH says). */
const now = () => `${new Date().toISOString().slice(11, 19)} UTC`;

export function Header({ title, width, height }: { title: string; width: number; height: number }) {
	const [time, setTime] = useState(now);
	useEffect(() => {
		const timer = setInterval(() => setTime(now()), 1000);
		return () => clearInterval(timer);
	}, []);
	return (
		<box style={{ flexDirection: 'row', height: 1, paddingLeft: 1, paddingRight: 1, backgroundColor: theme.panel }}>
			<text>
				<span fg={theme.accent}>╱╱╱─○ </span>
				<strong fg={theme.text}>raineworks</strong>
				<span fg={theme.faint}> / </span>
				<span fg={theme.muted}>{title.toLowerCase()}</span>
			</text>
			<box style={{ flexGrow: 1 }} />
			<text fg={theme.dim}>
				{`ssh · ${width}×${height} · `}
				<span fg={theme.muted}>{time}</span>
			</text>
		</box>
	);
}
