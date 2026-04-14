/**
 * Thin async wrapper around the Web Storage API (`localStorage` and
 * `sessionStorage`).
 *
 * The methods are intentionally `async` even though the underlying browser
 * APIs are synchronous. This allows consumers to swap in an async-native
 * backend (e.g. IndexedDB, React Native AsyncStorage, or an encrypted
 * store) without changing call-sites.
 *
 * @module lib/storage
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StorageBucket {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

interface Storage {
	/** Persistent storage — survives browser restarts. */
	local: StorageBucket;
	/** Session-scoped storage — cleared when the tab closes. */
	session: StorageBucket;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const storage: Storage = {
	local: {
		async get(key: string) {
			return localStorage.getItem(key);
		},
		async set(key: string, value: string) {
			localStorage.setItem(key, value);
		},
		async delete(key: string) {
			localStorage.removeItem(key);
		}
	},
	session: {
		async get(key: string) {
			return sessionStorage.getItem(key);
		},
		async set(key: string, value: string) {
			sessionStorage.setItem(key, value);
		},
		async delete(key: string) {
			sessionStorage.removeItem(key);
		}
	}
};
