/**
 * The site's name, as people read it (page titles, About), and what it's licensed under, as About's Legal tab and the
 * root `LICENSE` state it (a test holds the two together). The mark is `blocks/brand`, the colours `--brand` in
 * `styles/globals.css`.
 *
 * @module lib/brand
 */

/** The site's name as people read it. */
export const APP_NAME = 'raineworks';

/** Who holds the copyright, as the root `LICENSE`'s copyright line names them. */
export const COPYRIGHT_HOLDER = 'Raine Petersen';

/** The site's own licence, by its SPDX identifier and as people read it. */
export const APP_LICENSE = { spdx: 'MIT', name: 'MIT License' } as const;

/** Where the site's source is, public. */
export const SOURCE_URL = 'https://github.com/raine-works/raineworks';
