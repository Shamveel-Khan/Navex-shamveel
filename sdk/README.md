# @navex/sdk

TypeScript SDK that embeds the Navex agent into any web app.

Status: **not implemented yet** (Phase 3 of the MVP plan).

Planned public API:

```ts
import { WebAgent } from "@navex/sdk";

WebAgent.init({
  baseUrl: "http://localhost:8000",
  apiKey: "...",
  navigate: (path) => routerNavigate(path),
});
```

Modules planned for `src/`:

- `types.ts` — shared protocol types (PageState, UIElement, AgentAction, ...)
- `client.ts` — HTTP calls (`POST /api/chat`, `POST /api/agent/observation`)
- `observer.ts` — scans `[data-waid]` elements into a PageState
- `executor.ts` — executes whitelisted actions against the DOM
- `driver.ts` — run-turn loop with client-side step guard
- `chat-widget.ts` — floating chat UI
