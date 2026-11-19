/**
 * Builds the `marketing` zone with `Bun.build` (Tailwind, React Compiler).
 * `--watch` rebuilds on change, `@raineworks/ui` included; `@raineworks/server` serves `dist/` at the zone's basepath (`/`).
 */

import { join } from 'node:path';

import { runFrontendBuildCli } from '@raineworks/tools/build';
import { zonePublicPath } from '@raineworks/tools/zones';

const packageDir = join(import.meta.dir, '..');

await runFrontendBuildCli({
	name: 'web-marketing',
	packageDir,
	publicPath: zonePublicPath('marketing'),
	// `@raineworks/ui` is bundled in, so an edit there rebuilds this too.
	watchDirs: [join(packageDir, '../ui/src')],
});
