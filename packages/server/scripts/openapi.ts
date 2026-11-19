/**
 * The API's OpenAPI document (every `/api` route, what `GET /api/openapi.json` serves).
 *
 * ```bash
 * bun run openapi                 # prints it
 * bun run openapi --out api.json  # writes it
 * ```
 *
 * Generated from the routes alone: no server needs to run. Its `info.version` is the build's
 * (`@raineworks/tools/version`), so a copy says which release and commit it describes.
 *
 * @module scripts/openapi
 */

import { api } from '@raineworks/server/app';
import { generateSpec } from '@raineworks/server/lib/openapi';
import { buildInfo } from '@raineworks/tools/version';
import { Hono } from 'hono';

const { version, commit } = buildInfo();
const spec = await generateSpec(new Hono().route('/api', api) as never, `${version} (${commit})`);

const args = process.argv.slice(2);
const content = JSON.stringify(spec, null, 2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
if (out) await Bun.write(out, `${content}\n`);
else process.stdout.write(`${content}\n`);
