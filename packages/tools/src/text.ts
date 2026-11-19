/**
 * Small helpers for the words people read: counts with the right noun.
 *
 * @module text
 */

/**
 * `n` and the noun for it: `plural(1, 'project')` → "1 project",
 * `plural(3, 'project')` → "3 projects", `plural(2, 'person', 'people')` →
 * "2 people". The plural is `word` + "s" unless given.
 */
export function plural(count: number, word: string, pluralWord = `${word}s`): string {
	return `${count.toLocaleString('en-US')} ${count === 1 ? word : pluralWord}`;
}
