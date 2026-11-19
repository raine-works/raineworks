# @raineworks/web-marketing

The `marketing` zone: Raine Petersen's site, served at `/` (every path no other zone claims). For anyone who finds it,
mostly on a phone. How zones work: [docs/frontend.md](../../docs/frontend.md).

| Page | Route | What |
| --- | --- | --- |
| Home | `/` | Who Raine is, what Raine is building (bndl, Lux Financial), three featured projects |
| Work | `/work` | Experience and education as timelines |
| Projects | `/projects` | Every project, each card opening its repository |
| Hobbies | `/hobbies` | Each hobby with its icon |
| Contact | `/contact` | Email, GitHub, LinkedIn, Buy Me a Coffee |

What the pages say lives in `src/content/profile.ts`; the projects mirror the pinned repositories on
github.com/raine-works, alphabetically, three of them `featured`. Copy still marked `TODO(raine)` is kept off the pages.

The layout (`src/components/site-shell.tsx`) is the header (logo, pages, theme, phone menu) and footer (version
opening About, social links, coffee). Every page but Home loads lazily.

```bash
bun run dev     # Bun.build --watch: rebuilds on a change here or in @raineworks/ui
bun run build   # → dist/ (minified, precompressed, build.json, notices.json)
```
