/**
 * Temporal API global polyfill.
 *
 * Import this module once at each application entry point to make
 * the Temporal API available globally:
 *
 * ```ts
 * import '@rainestack/tools/temporal-polyfill';
 * ```
 *
 * When runtimes ship native Temporal, delete this file and remove
 * the entry-point imports. No other code changes are needed.
 *
 * @module temporal-polyfill
 */

import 'temporal-polyfill/global';
