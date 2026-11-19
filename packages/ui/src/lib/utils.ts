/**
 * Class-name helper used by every component: `clsx` for conditionals,
 * `tailwind-merge` so later utilities win over earlier conflicting ones.
 *
 * @module lib/utils
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names, conditionals included; a later Tailwind utility overrides an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
