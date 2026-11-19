import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { APP_LICENSE, COPYRIGHT_HOLDER } from '@raineworks/ui/lib/brand';

describe('the site’s licence', () => {
	test('is the one the root LICENSE is, held by whoever its copyright line names, so About and the repository agree', async () => {
		const license = await Bun.file(join(import.meta.dir, '../../../../LICENSE')).text();
		expect(license.split('\n')[0]).toBe(APP_LICENSE.name);
		expect(license).toMatch(new RegExp(`^Copyright \\(c\\) \\d{4} ${COPYRIGHT_HOLDER}$`, 'm'));
	});
});
