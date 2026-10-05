export type Limits = {
	maxConnections: number;
	maxPerIp: number;
	/** Max new connections per IP within `rateWindowMs`. */
	ratePerIp: number;
	rateWindowMs: number;
	handshakeTimeoutMs: number;
	idleTimeoutMs: number;
	maxColumns: number;
	maxRows: number;
};

export const defaultLimits: Limits = {
	maxConnections: 200,
	maxPerIp: 5,
	ratePerIp: 10,
	rateWindowMs: 60_000,
	handshakeTimeoutMs: 10_000,
	idleTimeoutMs: 5 * 60_000,
	maxColumns: 300,
	maxRows: 100,
};

export function clampSize(value: number, max: number, fallback: number): number {
	if (!Number.isFinite(value) || value < 1) return fallback;
	return Math.min(Math.floor(value), max);
}

/** Tracks open connections and recent connection attempts per IP. */
export class ConnectionGuard {
	private open = 0;
	private readonly perIp = new Map<string, number>();
	private readonly recent = new Map<string, number[]>();

	constructor(
		private readonly limits: Limits,
		private readonly now: () => number = Date.now,
	) {}

	/** Returns a release function when admitted, or null when the connection must be refused. */
	admit(ip: string): (() => void) | null {
		const t = this.now();
		const window = (this.recent.get(ip) ?? []).filter((ts) => t - ts < this.limits.rateWindowMs);
		window.push(t);
		this.recent.set(ip, window);
		if (window.length > this.limits.ratePerIp) return null;
		if (this.open >= this.limits.maxConnections) return null;
		if ((this.perIp.get(ip) ?? 0) >= this.limits.maxPerIp) return null;

		this.open++;
		this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.open--;
			const n = (this.perIp.get(ip) ?? 1) - 1;
			if (n <= 0) this.perIp.delete(ip);
			else this.perIp.set(ip, n);
		};
	}

	/** Drops stale rate-limit entries so the map cannot grow without bound. */
	sweep(): void {
		const t = this.now();
		for (const [ip, stamps] of this.recent) {
			const live = stamps.filter((ts) => t - ts < this.limits.rateWindowMs);
			if (live.length === 0) this.recent.delete(ip);
			else this.recent.set(ip, live);
		}
	}
}
