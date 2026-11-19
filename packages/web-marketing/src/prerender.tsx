/**
 * Renders the marketing zone's pages at build time (`scripts/build.ts`, `@raineworks/ui/app/prerender`): every route,
 * with its head, and the 404.
 *
 * @module prerender
 */

import { prerenderZone } from '@raineworks/ui/app/prerender';
import { router } from '@raineworks/web-marketing/router';

export const prerender = prerenderZone(router);
