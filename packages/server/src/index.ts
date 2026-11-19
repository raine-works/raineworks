/**
 * `@raineworks/server`'s public entry: the app factory, `AppType` for an RPC client, and the types its clients share (`Project`). Zones `import type` from
 * here, never values.
 *
 * @module @raineworks/server
 */

export type { AppType } from '@raineworks/server/app';
export type { Project } from '@raineworks/server/lib/github';
export { createApp } from '@raineworks/server/app';
