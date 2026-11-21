# @raineworks/web-marketing

The `marketing` zone: Raine Petersen's site, served at `/` (every path no other zone claims). For anyone who finds it,
mostly on a phone. How zones work: [docs/frontend.md](../../docs/frontend.md).

| Page | Route | What |
| --- | --- | --- |
| Home | `/` | Who Raine is, what Raine is building (bndl, Lux Financial), the featured projects |
| Work | `/work` | Experience and education as timelines |
| Projects | `/projects` | Every project, each card opening its page (or its repository, without one) |
| A project | `/projects/<slug>` | One project in detail: overview, highlights, getting started, what GitHub says about it now |
| Articles | `/articles` | Raine's articles on X, each opening it there, and the RSS feed (`/feed.xml`); only on with the server's `X_BEARER_TOKEN` |
| Hobbies | `/hobbies` | Each hobby with its icon |
| Contact | `/contact` | Email, GitHub, LinkedIn, X, Buy Me a Coffee |

What the pages say lives in `src/content/profile.ts`. Copy still marked `TODO(raine)` is kept off the pages.

The projects aren't kept here: they're the public repositories on github.com/raine-works with the topic `raineworks`
(forks and archived ones aside), live from `GET /api/projects`. Tag a repository to list it, and add
`raineworks-featured` to show it on Home too. Each card's text is the repository's description, and what it's built
with is its language, then its other topics: edit them on GitHub.

A project gets a page of its own once it's in `src/content/projects.ts` (its repository, its page's slug, title and
one-sentence summary) with its words in `src/content/project-pages.ts` (an overview, highlights and sections, written
from its README; plain text, typographic quotes; loaded only with the page). Each page is prerendered with its own
head (`staticData.pages` on the route); any other slug is the 404. `src/content/projects.test.ts` holds the two files
together.

The layout (`src/components/site-shell.tsx`) is the header (logo, pages, theme, phone menu) and footer (version
opening About, social links, coffee). Every page but Home loads lazily. Every page is prerendered (`src/prerender.tsx`)
with the head its route declares (`staticData.head` in `src/router.tsx`: title, description, share card; Home adds
Raine as schema.org JSON-LD). The projects load in the browser, never prerendered: placeholder cards hold their place until they're in.

The articles are off until the server has an X API token (`X_BEARER_TOKEN`): `GET /api/articles` says
`{ enabled: false }`, the nav leaves Articles out (it's listed only once the browser hears they're on, never
prerendered), the server sends the 404 for `/articles` (and the route's `beforeLoad` makes it the 404 in the browser too, so it hydrates as one), and there's no `/feed.xml`. The page is `unlisted`, so
`sitemap.xml` never names it.

```bash
bun run dev     # Bun.build --watch: rebuilds on a change here or in @raineworks/ui
bun run build   # → dist/ (minified, precompressed, every page prerendered, sitemap.xml, robots.txt, build.json, notices.json)
```
