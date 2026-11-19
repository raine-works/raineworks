/**
 * `bun run images`: the command line for what each image is built from (`@raineworks/tools/images`).
 *
 * ```
 * bun run images plan [--since <ref>]   JSON: each service, its inputs' hash, and whether that changed since <ref>
 * ```
 *
 * Only ever run as a process's entry point (CI's plan, by hand), so Bun's coverage can't count it: `images.test.ts`
 * runs it, and the package's `bunfig.toml` excludes this file by name.
 *
 * @module images-cli
 */

import { plan } from '@raineworks/tools/images';

const [command, ...args] = process.argv.slice(2);
if (command !== 'plan') throw new Error('Usage: bun run images plan [--since <ref>]');
const since = args.includes('--since') ? args[args.indexOf('--since') + 1] : undefined;
process.stdout.write(`${JSON.stringify(plan(since))}\n`);
