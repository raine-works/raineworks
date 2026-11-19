/**
 * Builds the `marketing` zone with `Bun.build` (Tailwind, React Compiler), every page prerendered (`src/prerender.tsx`)
 * with the site's share image beside it. `--watch` rebuilds on change, `@raineworks/ui` included; `@raineworks/server`
 * serves `dist/` at the zone's basepath (`/`).
 */

import { join } from 'node:path';

import { runFrontendBuildCli } from '@raineworks/tools/build';
import { zonePublicPath } from '@raineworks/tools/zones';
import { SITE_URL } from '@raineworks/ui/lib/brand';

const packageDir = join(import.meta.dir, '..');

await runFrontendBuildCli({
	name: 'web-marketing',
	packageDir,
	publicPath: zonePublicPath('marketing'),
	// `@raineworks/ui` is bundled in, so an edit there rebuilds this too.
	watchDirs: [join(packageDir, '../ui/src')],
	publicFiles: [join(packageDir, '../ui/src/assets/og-image.png')],
	prerender: { entry: join(packageDir, 'src/prerender.tsx'), siteUrl: SITE_URL },
});
