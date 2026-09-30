import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Removes temporary `.bun-build` compilation artifacts from a target directory.
 *
 * @param dir - Directory path to inspect and clean.
 */
export function cleanBunBuildArtifacts(dir: string): void {
	if (!existsSync(dir)) return;
	try {
		for (const file of readdirSync(dir)) {
			if (file.includes('.bun-build')) {
				try {
					rmSync(join(dir, file), { force: true, recursive: true });
				} catch {
					// Ignore deletion errors
				}
			}
		}
	} catch {
		// Ignore directory read errors
	}
}
