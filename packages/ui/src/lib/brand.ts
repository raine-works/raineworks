/**
 * The site's name, as people read it (page titles, About), where it's public, and what it's licensed under, as About's Legal tab and the
 * root `LICENSE` state it (a test holds the two together). The mark is `blocks/brand`, the colours `--brand` in
 * `styles/globals.css`.
 *
 * @module lib/brand
 */

/** The site's name as people read it. */
export const APP_NAME = 'raineworks';

/** Who holds the copyright (Raine's company), as the root `LICENSE`'s copyright line names it. */
export const COPYRIGHT_HOLDER = 'Raineworks LLC';

/** The site's own licence, by its SPDX identifier and as people read it. */
export const APP_LICENSE = { spdx: 'MIT', name: 'MIT License' } as const;

/** Where the site's source is, public. */
export const SOURCE_URL = 'https://github.com/raine-works/raineworks';

/** Where the site is public: canonical links, share cards and the sitemap are absolute against it. */
export const SITE_URL = 'https://raineworks.com';

/** What the site is, for a page that has nothing more specific to say (the 404). */
export const SITE_DESCRIPTION = 'Raine Petersen’s site: work, open-source projects and how to get in touch.';
