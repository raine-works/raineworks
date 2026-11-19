/**
 * Entrypoint of the `marketing` zone.
 *
 * @module main
 */

import '@raineworks/tools/prototypes';
import { mountZone } from '@raineworks/ui/app/root';
import { router } from '@raineworks/web-marketing/router';

await mountZone(router);
