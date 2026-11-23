import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');

describe('the repository', () => {
	test('tracks no file .gitignore ignores (local keys, env files, build output)', () => {
		const git = Bun.spawnSync(['git', 'ls-files', '--cached', '--ignored', '--exclude-standard'], { cwd: ROOT });
		expect(git.success).toBe(true);
		// A file committed before (or despite) its ignore rule stays tracked: `packages/ssh/.dev/host_key`, the SSH
		// development host key every clone makes for itself, was one. Untrack it (`git rm --cached`).
		expect(git.stdout.toString().split('\n').filter(Boolean)).toEqual([]);
	});
});
