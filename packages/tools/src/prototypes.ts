/**
 * Global Array, Set, Map, String and Promise prototype extensions for common convenience methods.
 *
 * Import this module once at the application entry point to make
 * these methods available globally:
 *
 * ```ts
 * import "@raineworks/tools/prototypes";
 *
 * // Arrays
 * const items = [1, 2, 3];
 * items.isEmpty(); // false
 * items.flush();   // items is now []
 *
 * // Sets and maps
 * new Set(items).isEmpty(); // false
 *
 * // Strings (`isEmpty` is no characters at all: `value.trim().isEmpty()` for blank)
 * ''.isEmpty(); // true
 *
 * // Promises
 * const { data, error } = await fetchUser(id).tryCatch();
 * if (error) return handleError(error);
 * console.log(data.name);
 * ```
 *
 * And `tryCatch(() => …)`, exported here, for work you call: its `Result` at once when the work is synchronous, a
 * promise of it to `await` when it's async.
 *
 * @module prototypes
 */

/** A successful result containing `data` and a `null` error. */
export type Success<T> = { data: T; error: null };

/** A failed result containing a `null` data field and the caught `error`. */
export type Failure<E> = { data: null; error: E };

/** Discriminated union — either a {@link Success} or a {@link Failure}. */
export type Result<T, E> = Success<T> | Failure<E>;

declare global {
	interface Array<T> {
		/** Returns `true` when the array has no elements. */
		isEmpty(): boolean;

		/** Removes all elements from the array in place by setting `length` to 0. */
		flush(): void;

		/** Returns a new array with duplicate values removed. Supports JSON objects and primitives. */
		unique(by?: (item: T) => unknown): T[];
	}

	/** The same methods on read-only arrays, bar `flush`, which mutates. */
	interface ReadonlyArray<T> {
		/** Returns `true` when the array has no elements. */
		isEmpty(): boolean;

		/** Returns a new array with duplicate values removed. Supports JSON objects and primitives. */
		unique(by?: (item: T) => unknown): T[];
	}

	interface Set<T> {
		/** Returns `true` when the set has no elements. */
		isEmpty(): boolean;
	}

	interface ReadonlySet<T> {
		/** Returns `true` when the set has no elements. */
		isEmpty(): boolean;
	}

	interface Map<K, V> {
		/** Returns `true` when the map has no entries. */
		isEmpty(): boolean;
	}

	interface ReadonlyMap<K, V> {
		/** Returns `true` when the map has no entries. */
		isEmpty(): boolean;
	}

	interface String {
		/** `true` when the string has no characters (`trim()` first to treat whitespace as empty). */
		isEmpty(): boolean;
	}

	interface Promise<T> {
		/**
		 * Wraps a `Promise` and returns a `Result` instead of throwing.
		 *
		 * @typeParam E - The error type (defaults to `Error`).
		 * @typeParam R - The return type (defaults to `T`).
		 *
		 * @example
		 * ```ts
		 * const { data, error } = await fetchUser(id).tryCatch();
		 *
		 * // With a custom error type and return type
		 * const { data, error } = await fetchUser(id).tryCatch<Error, GetDataResult>();
		 * ```
		 */
		tryCatch<E = Error, R = T>(): Promise<Result<R, E>>;
	}
}

function defineArrayPrototypeMethod<TArgs extends unknown[], TReturn>(
	name: 'isEmpty' | 'flush' | 'unique',
	value: (this: unknown[], ...args: TArgs) => TReturn,
): void {
	const existing = Object.getOwnPropertyDescriptor(Array.prototype, name);
	if (existing?.value) return;

	Object.defineProperty(Array.prototype, name, {
		value,
		writable: true,
		configurable: true,
		enumerable: false,
	});
}

/** Returns `true` when the array has no elements. */
defineArrayPrototypeMethod('isEmpty', function <T>(this: T[]): boolean {
	return this.length === 0;
});

/** Returns `true` when the set or map has no elements. */
for (const collection of [Set.prototype, Map.prototype]) {
	if (!Object.getOwnPropertyDescriptor(collection, 'isEmpty')?.value) {
		Object.defineProperty(collection, 'isEmpty', {
			value(this: { size: number }): boolean {
				return this.size === 0;
			},
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}
}

/** Returns `true` when the string has no characters. */
if (!Object.getOwnPropertyDescriptor(String.prototype, 'isEmpty')?.value) {
	Object.defineProperty(String.prototype, 'isEmpty', {
		value(this: string): boolean {
			return this.length === 0;
		},
		writable: true,
		configurable: true,
		enumerable: false,
	});
}

/**
 * Removes all elements from the array in place by setting its
 * `length` to 0. Unlike reassigning to `[]`, this mutates the
 * original reference so all holders of that reference see the change.
 */
defineArrayPrototypeMethod('flush', function <T>(this: T[]): void {
	this.length = 0;
});

/** Ids for objects with nothing to compare by (no own keys, no `toJSON`): each is only ever the same as itself. */
const opaqueIds = new WeakMap<object, number>();
let nextOpaqueId = 0;

/**
 * A key equal for equal values, used by `unique`: primitives by type and value, arrays in order, plain objects and
 * class instances by their own keys in any order (and their class), `Map`s by their entries and `Set`s by their
 * members in any order, and anything with a `toJSON` (Temporal values, `Date`s) by what it gives. Strings and keys are
 * JSON-encoded, so no value's text can pass for another's structure. An object with nothing to compare is only equal
 * to itself. A reference back to an object it's inside (a cycle) is written as how many levels up it points, so cyclic
 * values never overflow the stack and equal cycles are equal.
 */
function stableStringify(value: unknown, path: object[] = []): string {
	if (value === null) {
		return 'null';
	}
	if (value === undefined) {
		return 'undefined';
	}
	if (typeof value === 'string') {
		return `string:${JSON.stringify(value)}`;
	}
	if (typeof value !== 'object') {
		return `${typeof value}:${String(value)}`;
	}
	const at = path.lastIndexOf(value);
	if (at !== -1) {
		return `cycle:${path.length - at}`;
	}
	path.push(value);
	const key = stableStringifyObject(value, (inner) => stableStringify(inner, path));
	path.pop();
	return key;
}

/** `stableStringify` for an object, each value inside it keyed by `inner`. */
function stableStringifyObject(value: object, inner: (value: unknown) => string): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => inner(item)).join(',')}]`;
	}
	if (value instanceof Date) {
		return `date:${value.getTime()}`;
	}
	if (value instanceof RegExp) {
		return `regexp:${JSON.stringify(value.toString())}`;
	}
	if (value instanceof Map) {
		const entries = [...value].map(([k, v]) => `${inner(k)}=>${inner(v)}`).sort();
		return `map{${entries.join(',')}}`;
	}
	if (value instanceof Set) {
		return `set{${[...value]
			.map((member) => inner(member))
			.sort()
			.join(',')}}`;
	}
	const prototype = Object.getPrototypeOf(value);
	const plain = prototype === Object.prototype || prototype === null;
	const tag = plain ? '' : JSON.stringify(Object.prototype.toString.call(value) + (prototype?.constructor?.name ?? ''));
	// Temporal values (and other value types) have no own keys: they say what they are through `toJSON`.
	const toJSON = (value as { toJSON?: unknown }).toJSON;
	if (typeof toJSON === 'function') {
		return `json${tag}:${inner(toJSON.call(value))}`;
	}
	const keys = Object.keys(value).sort();
	if (!plain && keys.isEmpty()) {
		let id = opaqueIds.get(value);
		if (id === undefined) {
			id = nextOpaqueId++;
			opaqueIds.set(value, id);
		}
		return `opaque${tag}:${id}`;
	}
	const parts = keys.map((key) => `${JSON.stringify(key)}:${inner((value as Record<string, unknown>)[key])}`);
	return `${tag}{${parts.join(',')}}`;
}

/**
 * Returns a new array with duplicate values removed.
 * It compares JSON objects by their structure/properties (order-independent)
 * and primitives by their type and value.
 */
defineArrayPrototypeMethod('unique', function <T>(this: T[], by?: (item: T) => unknown): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const item of this) {
		const keyVal = by ? by(item) : item;
		const key = stableStringify(keyVal);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}
	return result;
});

// Promise prototype extensions
const existingPromiseTryCatch = Object.getOwnPropertyDescriptor(Promise.prototype, 'tryCatch');
if (!existingPromiseTryCatch?.value) {
	Object.defineProperty(Promise.prototype, 'tryCatch', {
		value: function <T, E = Error, R = T>(this: Promise<T>): Promise<Result<R, E>> {
			return this.then(
				(data) => ({ data, error: null }) as unknown as Success<R>,
				(error) => ({ data: null, error: error as E }) as Failure<E>,
			);
		},
		writable: true,
		configurable: true,
		enumerable: false,
	});
}

/** `T` that may be a promise: a sync `tryCatch` would hand back a promise where its type says a `Result`. */
type MaybeAsync<T> = 0 extends 1 & T ? false : [Extract<T, PromiseLike<unknown>>] extends [never] ? false : true;

/**
 * Calls `fn` now and returns its outcome as a `Result` instead of throwing: catching what it throws, and what its
 * promise rejects with when it's async.
 *
 * - **Synchronous work** (`JSON.parse`, `new URL`, storage, a process-exit hook): the `Result` comes back at once,
 *   with no promise in between, so it can be read where nothing can be awaited.
 * - **Async work** (`fn` returns a promise): a promise of the `Result`, to `await`. Left unawaited, its failure is
 *   dropped, like `void promise.tryCatch()`.
 * - **Either** (`fn` may return a value or a promise): a `Result` or a promise of one; `await` it.
 *
 * `fn` always runs before `tryCatch` returns, so its work starts even where nothing waits for the result. Only
 * synchronous work finishes in a process-exit hook: there, the async form's `Result` never arrives.
 *
 * @example
 * ```ts
 * const { data: url, error } = tryCatch(() => new URL(value));
 * const { data: user, error } = await tryCatch(() => fetchUser(id));
 * ```
 */
// The synchronous form first: a function that only throws returns `never`, which would also match `PromiseLike`.
export function tryCatch<T, E = Error>(
	fn: () => T,
	...synchronous: MaybeAsync<T> extends true ? ['fn may return a promise: await the result'] : []
): Result<T, E>;
export function tryCatch<T, E = Error>(fn: () => PromiseLike<T>): Promise<Result<T, E>>;
export function tryCatch<T, E = Error>(fn: () => T | PromiseLike<T>): Result<T, E> | Promise<Result<T, E>>;
export function tryCatch<T, E = Error>(fn: () => T | PromiseLike<T>): Result<T, E> | Promise<Result<T, E>> {
	let data: T | PromiseLike<T>;
	try {
		data = fn();
	} catch (error) {
		return { data: null, error: error as E };
	}
	if (typeof (data as { then?: unknown } | null)?.then === 'function') {
		return Promise.resolve(data).then(
			(value) => ({ data: value, error: null }) as Success<T>,
			(error) => ({ data: null, error: error as E }) as Failure<E>,
		);
	}
	return { data: data as T, error: null };
}
