import { describe, expect, test } from 'bun:test';

import { type Result, tryCatch } from '@raineworks/tools/prototypes';

describe('Array.prototype extensions', () => {
	describe('isEmpty', () => {
		test('should return true for an empty array', () => {
			expect([].isEmpty()).toBe(true);
		});

		test('should return false for a non-empty array', () => {
			expect([1].isEmpty()).toBe(false);
			expect(['a', 'b'].isEmpty()).toBe(false);
		});

		test('works on read-only arrays too', () => {
			const items: readonly number[] = [1, 1, 2];
			expect(items.isEmpty()).toBe(false);
			expect(items.unique()).toEqual([1, 2]);
		});
	});

	describe('flush', () => {
		test('should empty the array in place', () => {
			const arr = [1, 2, 3];
			arr.flush();
			expect(arr).toEqual([]);
			expect(arr.length).toBe(0);
		});

		test('should mutate the original reference', () => {
			const original = [1, 2, 3];
			const reference = original;
			original.flush();
			expect(reference).toEqual([]);
			expect(reference).toBe(original);
		});

		test('should do nothing on already empty array', () => {
			const arr: number[] = [];
			arr.flush();
			expect(arr).toEqual([]);
		});
	});

	describe('unique', () => {
		test('should return a new array', () => {
			const original = [1, 2, 3];
			const result = original.unique();
			expect(result).not.toBe(original);
			expect(result).toEqual(original);
		});

		test('should remove duplicate numbers and strings', () => {
			expect([1, 2, 2, 3, 1, 4].unique()).toEqual([1, 2, 3, 4]);
			expect(['a', 'b', 'a', 'c', 'b'].unique()).toEqual(['a', 'b', 'c']);
		});

		test('should handle mixed primitives and special values', () => {
			const input = [1, '1', true, 'true', null, undefined, null, undefined];
			expect(input.unique()).toEqual([1, '1', true, 'true', null, undefined]);
		});

		test('should handle deep object equality and remove duplicates regardless of key order', () => {
			const obj1 = { a: 1, b: 2 };
			const obj2 = { b: 2, a: 1 };
			const obj3 = { a: 1, b: 3 };
			const input = [obj1, obj2, obj3, obj1];
			const result = input.unique();
			expect(result).toEqual([
				{ a: 1, b: 2 },
				{ a: 1, b: 3 },
			]);
		});

		test('should handle nested objects and arrays', () => {
			const arr1 = [1, { x: [2, 3] }];
			const arr2 = [1, { x: [2, 3] }];
			const arr3 = [1, { x: [2, 4] }];
			const input = [arr1, arr2, arr3];
			expect(input.unique()).toEqual([arr1, arr3]);
		});

		test('should handle Date and RegExp objects', () => {
			const d1 = new Date(1600000000000);
			const d2 = new Date(1600000000000);
			const d3 = new Date(1700000000000);
			const r1 = /abc/gi;
			const r2 = /abc/gi;
			const r3 = /abc/g;

			expect([d1, d2, d3].unique()).toEqual([d1, d3]);
			expect([r1, r2, r3].unique()).toEqual([r1, r3]);
		});

		test('keeps Temporal values, Maps, Sets and keyless instances apart unless they are equal', () => {
			const a = Temporal.Instant.from('2026-01-01T00:00:00Z');
			const b = Temporal.Instant.from('2027-01-01T00:00:00Z');
			expect([a, b, Temporal.Instant.from('2026-01-01T00:00:00Z')].unique()).toEqual([a, b]);
			const day = Temporal.PlainDate.from('2026-01-01');
			expect([day, '2026-01-01', Temporal.PlainDate.from('2026-01-02')].unique()).toHaveLength(3);
			const full = new Map([[1, 2]]);
			const empty = new Map();
			expect([full, empty, new Map([[1, 2]])].unique()).toEqual([full, empty]);
			const set = new Set([1, 2]);
			expect([set, new Set([2, 1]), new Set([3])].unique()).toHaveLength(2);
			class Opaque {
				readonly #id = Math.random();
				get id() {
					return this.#id;
				}
			}
			const first = new Opaque();
			expect([first, new Opaque(), first].unique()).toHaveLength(2);
		});

		test('cyclic values are compared without overflowing the stack', () => {
			const loop = (name: string) => {
				const node: { name: string; self?: unknown; list: unknown[] } = { name, list: [] };
				node.self = node;
				node.list.push(node);
				return node;
			};
			const a = loop('a');
			expect([a, loop('a'), loop('b'), a].unique()).toEqual([a, expect.objectContaining({ name: 'b' })]);
			const map = new Map<string, unknown>();
			map.set('me', map);
			expect([map, map].unique()).toHaveLength(1);
			// The same object twice side by side is no cycle: it's compared like any other value.
			const shared = { x: 1 };
			expect(
				[
					{ a: shared, b: shared },
					{ a: { x: 1 }, b: { x: 1 } },
				].unique(),
			).toHaveLength(1);
		});

		test("a string's text never passes for an object's structure", () => {
			expect([{ a: 'x,b:string:y' }, { a: 'x', b: 'y' }].unique()).toHaveLength(2);
			expect([{ 'a:1,b': 1 }, { a: 1, b: 1 }].unique()).toHaveLength(2);
		});

		test('should respect the custom mapping function if provided', () => {
			const input = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
				{ id: 1, name: 'Charlie' },
			];
			const result = input.unique((item) => item.id);
			expect(result).toEqual([
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
			]);
		});

		test('should handle complex objects with custom mapping function', () => {
			const input = [
				{ meta: { tags: ['a', 'b'] }, val: 1 },
				{ meta: { tags: ['b', 'a'] }, val: 2 },
				{ meta: { tags: ['a', 'b'] }, val: 3 },
			];
			const result = input.unique((item) => item.meta);
			expect(result).toEqual([
				{ meta: { tags: ['a', 'b'] }, val: 1 },
				{ meta: { tags: ['b', 'a'] }, val: 2 },
			]);
		});
	});
});

describe('String prototype extensions', () => {
	test('isEmpty is true only without characters; whitespace counts until trimmed', () => {
		expect(''.isEmpty()).toBe(true);
		expect('a'.isEmpty()).toBe(false);
		expect(' '.isEmpty()).toBe(false);
		expect(' '.trim().isEmpty()).toBe(true);
		expect(String('').isEmpty()).toBe(true);
	});

	test('isEmpty is not enumerable', () => {
		expect(Object.keys(String.prototype)).not.toContain('isEmpty');
		// A string's own characters are all there is to iterate.
		expect(Object.keys('ab')).toEqual(['0', '1']);
	});
});

describe('Set and Map prototype extensions', () => {
	test('isEmpty is true only without elements', () => {
		expect(new Set().isEmpty()).toBe(true);
		expect(new Set([1]).isEmpty()).toBe(false);
		expect(new Map().isEmpty()).toBe(true);
		expect(new Map([['a', 1]]).isEmpty()).toBe(false);
		const set = new Set([1]);
		set.delete(1);
		expect(set.isEmpty()).toBe(true);
	});

	test('isEmpty is not enumerable', () => {
		expect(Object.keys(Set.prototype)).not.toContain('isEmpty');
		expect(Object.keys(Map.prototype)).not.toContain('isEmpty');
	});
});

describe('Promise.prototype extensions', () => {
	describe('tryCatch', () => {
		test('should resolve with Success object on resolved promise', async () => {
			const promise = Promise.resolve('hello');
			const result = await promise.tryCatch();
			expect(result).toEqual({ data: 'hello', error: null });
		});

		test('should resolve with Failure object on rejected promise', async () => {
			const errorInstance = new Error('something went wrong');
			const promise = Promise.reject(errorInstance);
			const result = await promise.tryCatch();
			expect(result).toEqual({ data: null, error: errorInstance });
		});

		test('should handle non-Error rejections', async () => {
			const errorString = 'string error';
			const promise = Promise.reject(errorString);
			const result = await promise.tryCatch<string>();
			expect(result).toEqual({ data: null, error: errorString });
		});

		test('should allow overriding the expected response type', async () => {
			const promise = Promise.resolve({ value: 'hello' } as unknown);
			const result = await promise.tryCatch<Error, { value: string }>();
			if (result.data) {
				const value: string = result.data.value;
				expect(value).toBe('hello');
			}
			expect(result).toEqual({ data: { value: 'hello' }, error: null });
		});
	});
});

describe('tryCatch', () => {
	test('returns what synchronous work returns at once, with no promise to wait for', () => {
		const result: Result<{ a: number }, Error> = tryCatch(() => JSON.parse('{"a":1}'));
		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toEqual({ data: { a: 1 }, error: null });
	});

	test('returns what synchronous work throws at once', () => {
		const { data, error } = tryCatch(() => JSON.parse('{'));
		expect(data).toBeNull();
		expect(error).toBeInstanceOf(SyntaxError);
	});

	test('can be read where nothing can be awaited, as in a process-exit hook', () => {
		let seen: unknown = 'nothing yet';
		const hook = () => {
			const { error } = tryCatch(() => {
				throw new Error('cleanup failed');
			});
			seen = error;
		};
		hook();
		expect(seen).toBeInstanceOf(Error);
	});

	test('async work is a promise of its Result, which the types make you await', async () => {
		const pending: Promise<Result<string, Error>> = tryCatch(async () => 'async success');
		// @ts-expect-error async work's Result isn't there until it's awaited
		const unawaited: Result<string, Error> = tryCatch(async () => 'async success');
		expect(unawaited).toBeInstanceOf(Promise);
		expect(await pending).toEqual({ data: 'async success', error: null });
		await unawaited;
	});

	test('returns what async work rejects with', async () => {
		const errorInstance = new Error('async reject');
		const result = await tryCatch(async () => {
			throw errorInstance;
		});
		expect(result).toEqual({ data: null, error: errorInstance });
	});

	test('calls async work at once, not on a later microtask', async () => {
		let ran = false;
		const pending = tryCatch(async () => {
			ran = true;
		});
		expect(ran).toBe(true);
		expect(await pending).toEqual({ data: undefined, error: null });
	});

	test('takes any thenable, not only a Promise', async () => {
		const thenable: PromiseLike<number> = { then: (resolve) => Promise.resolve(resolve?.(7)) as never };
		expect(await tryCatch(() => thenable)).toEqual({ data: 7, error: null });
	});

	test('work that may be either is a Result or a promise of one, and awaiting gives the Result', async () => {
		const either = (async: boolean): number | Promise<number> => (async ? Promise.resolve(2) : 1);
		const now = tryCatch(() => either(false));
		const later = tryCatch(() => either(true));
		expect(now).not.toBeInstanceOf(Promise);
		expect(later).toBeInstanceOf(Promise);
		expect(await now).toEqual({ data: 1, error: null });
		expect(await later).toEqual({ data: 2, error: null });
	});

	test('still catches an async callback the types let through, so it never escapes as an unhandled rejection', async () => {
		const errorInstance = new Error('listener failed');
		const listener: () => void = async () => {
			throw errorInstance;
		};
		const result: unknown = tryCatch(listener);
		expect(result).toBeInstanceOf(Promise);
		expect(await result).toEqual({ data: null, error: errorInstance });
	});
});
