/**
 * Lightweight error-handling primitives that replace try/catch with
 * a discriminated union. Every operation returns `{ data, error }`
 * so callers can handle failures with simple if-checks instead of
 * try/catch blocks.
 *
 * The error type parameter `E` defaults to `Error` but can be
 * narrowed to any custom error class for type-safe error handling.
 *
 * @module try-catch
 *
 * @example
 * ```ts
 * // Async operation — E defaults to Error
 * const { data, error } = await tryCatch(fetchUser(id));
 * if (error) return handleError(error);
 * console.log(data.name);
 *
 * // Custom error type
 * class ApiError extends Error {
 *   constructor(public status: number, message: string) {
 *     super(message);
 *   }
 * }
 *
 * const { data, error } = await tryCatch<User, ApiError>(fetchUser(id));
 * if (error) {
 *   console.log(error.status); // fully typed as ApiError
 * }
 *
 * // Synchronous operation
 * const { data, error } = tryCatch(() => JSON.parse(raw));
 * if (error) return handleParseError(error);
 *
 * // Async iterable (e.g. streaming)
 * for await (const { data, error } of tryCatch(stream)) {
 *   if (error) break;
 *   process(data);
 * }
 * ```
 */

/** A successful result containing `data` and a `null` error. */
export type Success<T> = { data: T; error: null };

/** A failed result containing a `null` data field and the caught `error`. */
export type Failure<E> = { data: null; error: E };

/** Discriminated union — either a {@link Success} or a {@link Failure}. */
export type Result<T, E> = Success<T> | Failure<E>;

/** Type guard: returns `true` when `input` implements `Symbol.asyncIterator`. */
function isAsyncIterable<T>(input: unknown): input is AsyncIterable<T> {
	return input != null && typeof (input as Record<symbol, unknown>)[Symbol.asyncIterator] === 'function';
}

/**
 * Wraps a synchronous function and returns a `Result` instead of throwing.
 *
 * @typeParam T - The return value type.
 * @typeParam E - The error type (defaults to `Error`).
 *
 * @example
 * ```ts
 * const { data, error } = tryCatch(() => JSON.parse(raw));
 *
 * // With a custom error type
 * const { data, error } = tryCatch<Config, ValidationError>(() => parseConfig(raw));
 * ```
 */
export function tryCatch<T, E = Error>(fn: () => T): Result<T, E>;

/**
 * Wraps a `Promise` and returns a `Result` instead of throwing.
 *
 * @typeParam T - The resolved value type.
 * @typeParam E - The error type (defaults to `Error`).
 *
 * @example
 * ```ts
 * const { data, error } = await tryCatch(fetchUser(id));
 *
 * // With a custom error type
 * const { data, error } = await tryCatch<User, ApiError>(fetchUser(id));
 * ```
 */
export function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>>;

/**
 * Wraps an `AsyncIterable` so each yielded value is a `Result`.
 * The generator yields `Success` values until the iterable throws,
 * at which point a single `Failure` is yielded and iteration ends.
 *
 * @typeParam T - The yielded value type.
 * @typeParam E - The error type (defaults to `Error`).
 *
 * @example
 * ```ts
 * for await (const { data, error } of tryCatch(stream)) {
 *   if (error) break;
 *   process(data);
 * }
 * ```
 */
export function tryCatch<T, E = Error>(iterable: AsyncIterable<T>): AsyncGenerator<Result<T, E>>;

/** @internal Implementation that dispatches between the three overloads. */
export function tryCatch<T, E = Error>(
	input: (() => T) | Promise<T> | AsyncIterable<T>
): Result<T, E> | Promise<Result<T, E>> | AsyncGenerator<Result<T, E>> {
	// Synchronous function
	if (typeof input === 'function') {
		try {
			const data = (input as () => T)();
			return { data, error: null } as Success<T>;
		} catch (error) {
			return { data: null, error: error as E } as Failure<E>;
		}
	}

	// Async iterable (checked before Promise because some iterables are also thenables)
	if (isAsyncIterable(input)) {
		return (async function* () {
			try {
				for await (const item of input) {
					yield { data: item, error: null } as Success<T>;
				}
			} catch (error) {
				yield { data: null, error: error as E } as Failure<E>;
			}
		})();
	}

	// Promise
	return input
		.then((data) => ({ data, error: null }) as Success<T>)
		.catch((error) => ({ data: null, error: error as E }) as Failure<E>);
}
