# @raineworks/api

The typed client for `@raineworks/server`, for the web zones and any other client (a native app, a script): a Hono `hc`
client over the server's `AppType`, so request and response types come from the routes with no codegen.

| Import | What it exports |
| --- | --- |
| `@raineworks/api` | `createApiClient({ url, fetch? })` (typed `hc<AppType>` client whose requests time out, an open event stream excepted), `createApiFetch`, `AppType`, `Project`, `ApiClient` |

Web zones don't use this package directly: `@raineworks/ui/lib/api` creates the page's single client and query cache
(see [docs/architecture.md](../../docs/architecture.md)).

```ts
import { createApiClient } from '@raineworks/api';

const api = createApiClient({ url: 'http://localhost:3032' });
const response = await api.api.build.$get({ query: { zone: 'marketing' } });
if (response.ok) console.log(await response.json());
```

The server is imported for its type only, so nothing server-side is bundled. Once the app has sign-in, this is where
the session belongs: a client that holds it, and a `fetch` that attaches it and refreshes it on a 401.
