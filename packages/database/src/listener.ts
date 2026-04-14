/**
 * Real-time database change listener via PostgreSQL LISTEN/NOTIFY.
 *
 * Provides the {@link DatabaseListener} class which subscribes to the
 * `table_change` notification channel fired by the SQL triggers in
 * `scripts/triggers.sql`. Uses a dedicated `pg.Client` (not a pool)
 * because LISTEN requires a single persistent connection.
 *
 * Supports three subscription granularities:
 * - **All changes** — `listener.onChange(handler)`
 * - **Per-table** — `listener.onTable("User", handler)`
 * - **Per-operation** — `listener.onOperation("User", "DELETE", handler)`
 *
 * Automatic reconnection with exponential backoff and full jitter is
 * built in. Registered handlers are preserved across reconnections —
 * no re-subscription is needed by the caller.
 *
 * @module listener
 */

import '@rainestack/tools/prototypes';
import { tryCatch } from '@rainestack/tools/try-catch';
import pg from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TableOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface TableChangeEvent {
	/** The table name (e.g. "User") */
	table: string;
	/** The schema name (e.g. "public") */
	schema: string;
	/** INSERT | UPDATE | DELETE */
	operation: TableOperation;
	/** The primary key of the affected row */
	id: string;
	/** Unix epoch seconds when the change occurred */
	timestamp: number;
}

export interface ReconnectOptions {
	/** Whether automatic reconnection is enabled. Defaults to `true`. */
	enabled: boolean;
	/** Base delay in milliseconds before the first retry. Defaults to `1000` (1 s). */
	baseDelayMs: number;
	/** Maximum delay in milliseconds between retries. Defaults to `30_000` (30 s). */
	maxDelayMs: number;
	/** Maximum number of consecutive reconnection attempts before giving up. Defaults to `Infinity`. */
	maxAttempts: number;
}

type ChangeHandler = (event: TableChangeEvent) => void;
type ErrorHandler = (error: Error) => void;

const CHANNEL = 'table_change';

const DEFAULT_RECONNECT: ReconnectOptions = {
	enabled: true,
	baseDelayMs: 1_000,
	maxDelayMs: 30_000,
	maxAttempts: Number.POSITIVE_INFINITY
};

/** Type guard: returns `true` when `value` matches the {@link TableChangeEvent} shape. */
function isTableChangeEvent(value: unknown): value is TableChangeEvent {
	if (typeof value !== 'object' || value === null) return false;
	return (
		'table' in value &&
		typeof value.table === 'string' &&
		'schema' in value &&
		typeof value.schema === 'string' &&
		'operation' in value &&
		typeof value.operation === 'string' &&
		'id' in value &&
		typeof value.id === 'string' &&
		'timestamp' in value &&
		typeof value.timestamp === 'number'
	);
}

/**
 * Computes an exponential backoff delay with full jitter.
 *
 * `delay = random(0, min(maxDelay, baseDelay * 2^attempt))`
 *
 * Full jitter avoids the "thundering herd" problem when many clients
 * reconnect simultaneously after an outage.
 */
function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
	const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
	return Math.floor(Math.random() * exponential);
}

// ---------------------------------------------------------------------------
// DatabaseListener
// ---------------------------------------------------------------------------

/**
 * Subscribes to PostgreSQL LISTEN/NOTIFY events fired by the
 * `notify_table_change()` trigger function.
 *
 * Uses a dedicated `pg.Client` (not a pool) because LISTEN requires
 * a single persistent connection that is never returned to a pool.
 *
 * If the connection drops unexpectedly the listener will automatically
 * reconnect with exponential backoff (configurable via the
 * `reconnect` constructor option). Registered handlers are preserved
 * across reconnections — no re-subscription is needed by the caller.
 *
 * @example
 * ```ts
 * const listener = new DatabaseListener(process.env.DATABASE_URL!);
 * await listener.connect();
 *
 * listener.onChange((event) => {
 *   console.log(`${event.operation} on ${event.table}: ${event.id}`);
 * });
 *
 * listener.onTable("User", (event) => {
 *   console.log("User changed:", event.id);
 * });
 *
 * listener.onOperation("User", "DELETE", (event) => {
 *   console.log("User deleted:", event.id);
 * });
 * ```
 */
export class DatabaseListener {
	private connectionString: string;
	private client: pg.Client | null = null;
	private connected = false;
	private reconnecting = false;
	private intentionalDisconnect = false;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectOpts: ReconnectOptions;
	private changeHandlers = new Map<string, Set<ChangeHandler>>();
	private errorHandlers = new Set<ErrorHandler>();

	constructor(connectionString: string, reconnect?: Partial<ReconnectOptions>) {
		this.connectionString = connectionString;
		this.reconnectOpts = { ...DEFAULT_RECONNECT, ...reconnect };
	}

	/** Connect to PostgreSQL and start listening on the table_change channel. */
	async connect(): Promise<void> {
		if (this.connected) return;

		this.intentionalDisconnect = false;
		this.client = new pg.Client({ connectionString: this.connectionString, options: '-c timezone=UTC' });

		await this.client.connect();
		this.connected = true;
		this.reconnectAttempt = 0;
		this.reconnecting = false;

		this.attachClientListeners(this.client);
		await this.client.query(`LISTEN ${CHANNEL}`);
	}

	/** Listen to every table change event. Returns an unsubscribe function. */
	onChange(handler: ChangeHandler): () => void {
		return this.subscribe('*', handler);
	}

	/** Listen to all changes on a specific table. Returns an unsubscribe function. */
	onTable(table: string, handler: ChangeHandler): () => void {
		return this.subscribe(table, handler);
	}

	/** Listen to a specific operation on a specific table. Returns an unsubscribe function. */
	onOperation(table: string, operation: TableOperation, handler: ChangeHandler): () => void {
		return this.subscribe(`${table}:${operation}`, handler);
	}

	/** Listen to errors from the connection or payload parsing. Returns an unsubscribe function. */
	onError(handler: ErrorHandler): () => void {
		this.errorHandlers.add(handler);
		return () => {
			this.errorHandlers.delete(handler);
		};
	}

	/** Whether the listener is currently connected. */
	get isConnected(): boolean {
		return this.connected;
	}

	/** Whether the listener is currently attempting to reconnect. */
	get isReconnecting(): boolean {
		return this.reconnecting;
	}

	/**
	 * Number of consecutive reconnection failures since the last
	 * successful connection. Resets to `0` on a successful connect
	 * or reconnect.
	 *
	 * External health monitors can poll this value to decide whether
	 * the database has been unreachable for too long and trigger a
	 * graceful shutdown.
	 */
	get consecutiveFailures(): number {
		return this.reconnectAttempt;
	}

	/** Disconnect and remove all subscriptions. */
	async disconnect(): Promise<void> {
		this.intentionalDisconnect = true;
		this.cancelPendingReconnect();

		if (!this.connected || !this.client) {
			this.connected = false;
			this.reconnecting = false;
			this.changeHandlers.clear();
			this.errorHandlers.clear();
			return;
		}

		// Connection may already be broken — ignore errors from UNLISTEN / end.
		await tryCatch(this.client.query(`UNLISTEN ${CHANNEL}`));
		await tryCatch(this.client.end());

		this.client = null;
		this.connected = false;
		this.reconnecting = false;
		this.changeHandlers.clear();
		this.errorHandlers.clear();
	}

	// -----------------------------------------------------------------------
	// Internal — client event wiring
	// -----------------------------------------------------------------------

	/**
	 * Attaches `notification` and `error` listeners to a `pg.Client`.
	 *
	 * Extracted into its own method so the same logic can be reused
	 * after a reconnection creates a new client instance.
	 */
	private attachClientListeners(client: pg.Client): void {
		client.on('notification', async (msg) => {
			if (msg.channel !== CHANNEL || !msg.payload) return;

			const { data: parsed, error } = tryCatch<unknown>(() => JSON.parse(msg.payload ?? '{}'));

			if (error) {
				this.dispatchError(error);
				return;
			}

			if (!isTableChangeEvent(parsed)) {
				this.dispatchError(new Error(`Invalid table change payload: ${msg.payload}`));
				return;
			}

			this.dispatchChange('*', parsed);
			this.dispatchChange(parsed.table, parsed);
			this.dispatchChange(`${parsed.table}:${parsed.operation}`, parsed);
		});

		client.on('error', (err) => {
			this.connected = false;
			this.dispatchError(err);
			this.scheduleReconnect();
		});

		// `end` fires when the connection is closed (cleanly or not).
		// If we didn't initiate the close, treat it as unexpected.
		client.on('end', () => {
			if (this.intentionalDisconnect) return;
			this.connected = false;
			this.scheduleReconnect();
		});
	}

	// -----------------------------------------------------------------------
	// Internal — reconnection
	// -----------------------------------------------------------------------

	/**
	 * Schedules a reconnection attempt using exponential backoff with
	 * full jitter. No-ops if reconnection is disabled, already in
	 * progress, or the disconnect was intentional.
	 */
	private scheduleReconnect(): void {
		if (!this.reconnectOpts.enabled) return;
		if (this.intentionalDisconnect) return;
		if (this.reconnecting) return;

		if (this.reconnectAttempt >= this.reconnectOpts.maxAttempts) {
			const err = new Error(`[db:listener] giving up after ${this.reconnectAttempt} reconnection attempts`);
			this.dispatchError(err);
			return;
		}

		this.reconnecting = true;
		const delay = backoffDelay(this.reconnectAttempt, this.reconnectOpts.baseDelayMs, this.reconnectOpts.maxDelayMs);

		console.log(`[db:listener] connection lost — reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.attemptReconnect();
		}, delay);
	}

	/**
	 * Performs a single reconnection attempt.
	 *
	 * Creates a fresh `pg.Client`, connects it, re-issues `LISTEN`,
	 * and reattaches event handlers. On failure the next attempt is
	 * scheduled with an incremented backoff counter.
	 */
	private async attemptReconnect(): Promise<void> {
		if (this.intentionalDisconnect) return;

		this.reconnectAttempt++;

		// Tear down the old client if it still exists.
		if (this.client) {
			await tryCatch(this.client.end());
			this.client = null;
		}

		const newClient = new pg.Client({ connectionString: this.connectionString, options: '-c timezone=UTC' });

		const { error: connectError } = await tryCatch(newClient.connect());

		if (connectError) {
			this.dispatchError(
				new Error(`[db:listener] reconnection attempt ${this.reconnectAttempt} failed: ${connectError.message}`)
			);
			this.reconnecting = false;
			this.scheduleReconnect();
			return;
		}

		const { error: listenError } = await tryCatch(newClient.query(`LISTEN ${CHANNEL}`));

		if (listenError) {
			this.dispatchError(new Error(`[db:listener] LISTEN failed after reconnect: ${listenError.message}`));
			await tryCatch(newClient.end());
			this.reconnecting = false;
			this.scheduleReconnect();
			return;
		}

		// Success — swap in the new client.
		this.client = newClient;
		this.connected = true;
		this.reconnecting = false;
		this.reconnectAttempt = 0;

		this.attachClientListeners(newClient);
		console.log('[db:listener] reconnected successfully');
	}

	/** Cancels any pending reconnection timer. */
	private cancelPendingReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	// -----------------------------------------------------------------------
	// Internal — handler dispatch
	// -----------------------------------------------------------------------

	private subscribe(key: string, handler: ChangeHandler): () => void {
		let set = this.changeHandlers.get(key);
		if (!set) {
			set = new Set();
			this.changeHandlers.set(key, set);
		}
		set.add(handler);

		return () => {
			set.delete(handler);
			if (set.isEmpty()) {
				this.changeHandlers.delete(key);
			}
		};
	}

	private dispatchChange(key: string, event: TableChangeEvent): void {
		const set = this.changeHandlers.get(key);
		if (!set) return;
		for (const handler of set) {
			// Isolate each handler so one failure doesn't break the rest.
			// Fire-and-forget — errors from handlers are routed to error subscribers.
			tryCatch(Promise.resolve().then(() => handler(event))).then(({ error }) => {
				if (error) {
					this.dispatchError(error);
				}
			});
		}
	}

	private dispatchError(error: Error): void {
		for (const handler of this.errorHandlers) {
			try {
				handler(error);
			} catch {
				// Swallow errors from error handlers to avoid infinite loops.
			}
		}
	}
}
