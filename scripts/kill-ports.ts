#!/usr/bin/env bun
/**
 * `bun run dev:kill`: stops this repo's `bun run dev` (the backend's `--watch` server, every frontend's watcher and
 * the `--parallel` runner over them), such as one left running in another terminal, so the next one can start.
 *
 * Only processes whose working directory is inside this repo are stopped: another project's dev server on the same
 * port (another app's Vite on :3000, say) is reported, never touched. Each gets SIGTERM, then SIGKILL if it's still
 * there after `GRACE_MS`. `--dry-run` lists what it would stop.
 *
 * @module scripts/kill-ports
 */

import { join } from 'node:path';

import { tryCatch } from '@raineworks/tools/prototypes';

const REPO_ROOT = join(import.meta.dir, '..');
const PORT = Number(Bun.env.PORT ?? 3032);
const GRACE_MS = 3_000;
const DRY_RUN = Bun.argv.includes('--dry-run');
/** What `bun run dev` starts: the runner, the backend's `bun --watch`, and each frontend's `scripts/build.ts --watch`. */
const DEV_COMMAND = /^(\S*\/)?bun\s(.*\s)?(--watch\b|run\s+(--parallel\b|dev\b))/;

const run = (cmd: string[]) => Bun.spawnSync(cmd).stdout.toString();

/** Every process's working directory, from one `lsof` call (`p<pid>` then `n<path>` lines). */
function workingDirectories(): Map<number, string> {
	const cwds = new Map<number, string>();
	let pid = 0;
	for (const line of run(['lsof', '-a', '-d', 'cwd', '-Fpn']).split('\n')) {
		if (line.startsWith('p')) pid = Number(line.slice(1));
		if (line.startsWith('n')) cwds.set(pid, line.slice(1));
	}
	return cwds;
}

/** Whether `pid` is still running: signal 0 checks it exists without touching it, and throws once it's gone. */
const alive = (pid: number): boolean => !tryCatch(() => process.kill(pid, 0)).error;

const cwds = workingDirectories();
const ours = (pid: number) => {
	const cwd = cwds.get(pid);
	return cwd === REPO_ROOT || cwd?.startsWith(`${REPO_ROOT}/`) === true;
};
// This script and the `bun run dev:kill` that started it run here too.
const self = new Set([process.pid, process.ppid]);

const stopping: number[] = [];
for (const line of run(['ps', '-Ao', 'pid=,command=']).split('\n')) {
	const match = line.trim().match(/^(\d+)\s+(.*)$/);
	if (!match) continue;
	const pid = Number(match[1]);
	const command = match[2] ?? '';
	if (self.has(pid) || !DEV_COMMAND.test(command) || !ours(pid)) continue;
	console.log(`${pid} ${command}: ${DRY_RUN ? 'would stop' : 'stopping'}`);
	if (DRY_RUN) continue;
	// Stopping `bun run dev` can take its children down before they're reached: one already gone is stopped.
	if (!tryCatch(() => process.kill(pid, 'SIGTERM')).error) stopping.push(pid);
}
if (stopping.isEmpty() && !DRY_RUN) console.log('No dev server running from this repo');

const deadline = performance.now() + GRACE_MS;
while (stopping.some(alive) && performance.now() < deadline) await Bun.sleep(100);
for (const pid of stopping.filter(alive)) {
	console.log(`${pid} didn't stop: killing it`);
	tryCatch(() => process.kill(pid, 'SIGKILL'));
}

// Whatever still holds the port isn't ours (or is, on a dry run): say whose it is rather than stop it.
const holders = run(['lsof', '-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-Fpc'])
	.split('\n')
	.filter((line) => /^[pc]/.test(line));
for (let i = 0; i < holders.length; i += 2) {
	const pid = Number(holders[i]?.slice(1));
	const where = cwds.get(pid) ?? 'an unknown directory';
	const note = ours(pid) ? 'this repo’s' : 'not this repo’s, left running';
	console.log(`:${PORT} is held by ${holders[i + 1]?.slice(1)} (${pid}, in ${where}): ${note}`);
}
