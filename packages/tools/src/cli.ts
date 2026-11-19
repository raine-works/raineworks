/**
 * Helpers for the repo's command-line scripts: terminal colours and cleaning up after `bun build --compile`.
 *
 * @module cli
 */

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { tryCatch } from '@raineworks/tools/prototypes';

/**
 * Standard ANSI escape codes for formatted CLI console output.
 */
export const colors = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	italic: '\x1b[3m',
	underline: '\x1b[4m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
	white: '\x1b[37m',
	gray: '\x1b[90m',
} as const;

/**
 * Removes temporary `.bun-build` compilation artifacts from a target directory.
 *
 * @param dir - Directory path to inspect and clean.
 */
export function cleanBunBuildArtifacts(dir: string): void {
	if (!existsSync(dir)) return;
	// Ignore directory read errors
	const { data: files } = tryCatch(() => readdirSync(dir));
	for (const file of files ?? []) {
		if (file.includes('.bun-build')) {
			// Ignore deletion errors
			tryCatch(() => rmSync(join(dir, file), { force: true, recursive: true }));
		}
	}
}
