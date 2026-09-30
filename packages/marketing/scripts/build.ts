import { join } from 'node:path';
import { runFrontendBuildCli } from '@app/tools/build';

const packageDir = join(import.meta.dir, '..');

await runFrontendBuildCli({
	name: 'marketing',
	packageDir,
	publicPath: '/',
});
