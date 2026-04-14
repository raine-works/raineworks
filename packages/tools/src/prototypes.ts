/**
 * Global prototype extensions for common convenience methods.
 *
 * Import this module once at the application entry point to make
 * these methods available across your application:
 *
 * ```ts
 * import "@rainestack/tools/prototypes";
 * const items = [1, 2, 3];
 * items.isEmpty(); // false
 * items.flush();   // items is now []
 * ```
 *
 * ## Array Extensions
 *
 * These extensions provide convenient methods for working with arrays:
 *
 * - `Array.prototype.isEmpty()` — Returns `true` when the array has no elements.
 * - `Array.prototype.flush()` — Removes all elements from the array in place.
 *
 * ## Collection Extensions
 *
 * These extensions provide convenient methods for working with collections:
 *
 * - `Set.prototype.isEmpty()` — Returns `true` when the set has no elements.
 * - `Map.prototype.isEmpty()` — Returns `true` when the map has no entries.
 *
 * ## Primitive Type Extensions
 *
 * These extensions add a getter property to check if values "exist" (are valid/non-empty):
 *
 * - `Number.prototype.exists` — Returns `true` when the value is not `NaN`.
 * - `String.prototype.exists` — Returns `true` when the string is not empty.
 * - `Object.prototype.exists` — Returns `true` when the object has own properties.
 *
 * @module prototypes
 */

declare global {
	/**
	 * Interface extension for Array types with convenience methods.
	 */
	interface Array<T> {
		/** Returns `true` when the array has no elements. */
		isEmpty(): boolean;

		/** Removes all elements from the array in place by setting `length` to 0. */
		flush(): void;
	}

	/**
	 * Interface extension for Set types with convenience methods.
	 */
	interface Set<T> {
		/** Returns `true` when the set has no elements. */
		isEmpty(): boolean;
	}

	/**
	 * Interface extension for Map types with convenience methods.
	 */
	interface Map<K, V> {
		/** Returns `true` when the map has no entries. */
		isEmpty(): boolean;
	}

	/**
	 * Interface extension for Number types with existence check.
	 */
	interface Number {
		/** Returns `true` when the value is not `NaN`. */
		readonly exists: boolean;
	}

	/**
	 * Interface extension for String types with existence check.
	 */
	interface String {
		/** Returns `true` when the string is not empty. */
		readonly exists: boolean;
	}

	/**
	 * Interface extension for Object types with existence check.
	 */
	interface Object {
		/** Returns `true` when the object has own properties. */
		readonly exists: boolean;
	}
}

/**
 * Returns `true` when the array has no elements.
 *
 * @param {T[]} self - The array to check (provided via Function.prototype.call or Array.prototype method).
 * @returns {boolean} `true` if the array is empty, `false` otherwise.
 *
 * @example
 * const items: number[] = [];
 * items.isEmpty(); // true
 *
 * @example
 * const values = [1, 2, 3];
 * values.isEmpty(); // false
 */
Array.prototype.isEmpty = function <T>(this: T[]): boolean {
	return this.length === 0;
};

/**
 * Removes all elements from the array in place by setting its
 * `length` to 0. Unlike reassigning to `[]`, this mutates the
 * original reference so all holders of that reference see the change.
 *
 * @returns {void}
 *
 * @example
 * const items = [1, 2, 3];
 * items.flush();
 * console.log(items.length); // 0
 */
Array.prototype.flush = function <T>(this: T[]): void {
	this.length = 0;
};

/**
 * Returns `true` when the set has no elements.
 *
 * @returns {boolean} `true` if the set is empty, `false` otherwise.
 *
 * @example
 * const items = new Set<number>();
 * items.isEmpty(); // true
 *
 * @example
 * const values = new Set([1, 2, 3]);
 * values.isEmpty(); // false
 */
Set.prototype.isEmpty = function (this: Set<unknown>): boolean {
	return this.size === 0;
};

/**
 * Returns `true` when the map has no entries.
 *
 * @returns {boolean} `true` if the map is empty, `false` otherwise.
 *
 * @example
 * const items = new Map<string, number>();
 * items.isEmpty(); // true
 *
 * @example
 * const values = new Map([['a', 1], ['b', 2]]);
 * values.isEmpty(); // false
 */
Map.prototype.isEmpty = function (this: Map<unknown, unknown>): boolean {
	return this.size === 0;
};

/**
 * Returns `true` when the value is not `NaN`.
 *
 * @returns {boolean} `true` if the number is a valid number, `false` if `NaN`.
 *
 * @example
 * const n: number = NaN;
 * n.exists; // false
 *
 * @example
 * const m: number = 42;
 * m.exists; // true
 */
Object.defineProperty(Number.prototype, 'exists', {
	get: function (this: number): boolean {
		return !Number.isNaN(this);
	},
	configurable: true
});

/**
 * Returns `true` when the string is not empty.
 *
 * @returns {boolean} `true` if the string has length greater than 0.
 *
 * @example
 * const s: string = '';
 * s.exists; // false
 *
 * @example
 * const t: string = 'hello';
 * t.exists; // true
 */
Object.defineProperty(String.prototype, 'exists', {
	get: function (this: string): boolean {
		return this.length > 0;
	},
	configurable: true
});

/**
 * Returns `true` when the object has own properties.
 *
 * @returns {boolean} `true` if the object has at least one own property.
 *
 * @example
 * const obj: Record<string, unknown> = {};
 * obj.exists; // false
 *
 * @example
 * const record = { a: 1, b: 2 };
 * record.exists; // true
 */
Object.defineProperty(Object.prototype, 'exists', {
	get: function (this: Record<string, unknown>): boolean {
		return Object.keys(this).length > 0;
	},
	configurable: true
});

export {};
