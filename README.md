# Navex

An embeddable AI agent that executes tasks inside web apps through a strict,
validated UI-action loop (`navigate / click / fill / select / submit`).

This repo currently contains **Phase 0–6** of the MVP plan:

- `backend/` — FastAPI API with the full agent loop. Two LLM modes:
  - **FakeLLM** (default) — scripted golden path for testing without a key
  - **RealLLM** — OpenRouter with strict `json_schema` structured output,
    automatic fallback to JSON-object mode, one repair retry, and 429
    rate-limit backoff; graceful failures in every error path.
  Safety: registry/page-state validation of every action, invalid-proposal
  feedback loop, repeat-action detection, MAX_STEPS, per-session locks.
  Auth: `Authorization: Bearer $NAVEX_DEV_KEY` on all routes except health.
- `demo-app/` — React SPA ("TaskFlow") the agent operates, with stable
  `data-waid` element IDs as the SDK contract
- `sdk/` — **embeddable chat widget + agent client** (`WebAgent.init`),
  DOM observer (`observe()`), action executor, turn driver with client-side
  step guard, and the `window.__navex` dev harness.

## Run the backend

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # add your OpenRouter key later phases
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

- Health check: http://localhost:8000/api/health
- Swagger docs: http://localhost:8000/docs
- Tests: `.venv/bin/pytest -q`

### The loop (server side)

1. `POST /api/sessions` → `{session_id}`
2. `POST /api/chat {session_id, message}` → either
   `{type:"action", step, action}` or `{type:"final", reason, message}`
3. SDK executes the action in the browser and posts the fresh DOM state to
   `POST /api/agent/observation {session_id, result:{status, page}}`
4. Repeat step 2↔3 until `final`

Every proposed action is validated server-side against the page registry and
the latest observed UI state before it is ever returned to the browser;
invalid proposals are fed back as corrections (bounded retries).

### Embedding the agent (Phase 6)

The demo app wires it up in `src/App.tsx`; this is all an integrating app needs:

```tsx
import { WebAgent } from "@navex/sdk";

useEffect(() => {
  const agent = WebAgent.init({
    apiKey: "your-navex-key",
    navigate: (path) => routerNavigate(path), // host provides SPA navigation
    baseUrl: "",                              // optional, defaults to same origin
  });
  return () => agent.destroy();
}, []);
```

A floating ✦ launcher appears bottom-right. Users type requests; the SDK
observes the page, executes validated actions, and reports results — exactly
the loop described above.

## Testing

```bash
# backend unit/integration suite (forces FakeLLM, no tokens spent)
cd backend && .venv/bin/pytest -q

# real-model checks (requires NAVEX_OPENROUTER_API_KEY + USE_FAKE_LLM=false)
.venv/bin/python scripts/smoke_llm.py       # 4 single-decision scenarios
.venv/bin/uvicorn app.main:app --port 8000 &
.venv/bin/python scripts/simulate_turn.py   # full turns vs a simulated browser
```

Manual browser check: start backend + `demo-app` (`npm run dev`), click the ✦
launcher on http://localhost:5173, and type "Create a project called Alpha."
The page should navigate itself, open the modal, fill the name, save, and the
widget should confirm completion.

## Using a different LLM provider

Any OpenAI-compatible endpoint works — set `NAVEX_LLM_BASE_URL` (plus matching
model and key) in `backend/.env`:

| Provider | `NAVEX_LLM_BASE_URL` | model example |
|---|---|---|
| OpenRouter (default) | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| OpenAI direct | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.1-70b-versatile` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1`, `qwen2.5:14b` |

Strict structured outputs fall back to JSON-object mode automatically when a
provider or model doesn't support them.

## Run the demo app

```bash
cd demo-app
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :8000)
```

## Agent-facing UI contract (data-waid)

| Page | Element ID | Type |
|---|---|---|
| Dashboard | `go_to_projects_button` | button |
| Dashboard | `go_to_settings_button` | button |
| Projects | `search_projects_input` | input |
| Projects | `create_project_button` | button |
| Create modal | `new_project_form` | form |
| Create modal | `project_name_input` | input |
| Create modal | `project_description_input` | textarea |
| Create modal | `priority_select` | select (High/Medium/Low) |
| Create modal | `save_project_button` | button |
| Create modal | `cancel_project_button` | button |
| Settings | `settings_form` | form |
| Settings | `display_name_input` | input |
| Settings | `email_notifications_checkbox` | checkbox |
| Settings | `save_settings_button` | button |

Golden-path task for later phases: from any page, ask
"Create a project called Alpha." — expected flow is
navigate(`/projects`) → click(`create_project_button`) →
fill(`project_name_input`, "Alpha") → click(`save_project_button`) → done.

## Manual testing of the SDK (Phase 3)

With the demo app running, open DevTools console on http://localhost:5173 and paste:

```js
const a = window.__navex;
await a.observe();                                                   // current page + visible elements
await a.execute({ type: "navigate", path: "/projects" });            // SPA navigation + rescan
await a.execute({ type: "click", element_id: "create_project_button" }); // modal opens, rescan includes form fields
await a.execute({ type: "fill", element_id: "project_name_input", value: "Alpha" });
await a.execute({ type: "select", element_id: "priority_select", value: "High" });
await a.execute({ type: "submit", form_id: "new_project_form" });    // toast appears, list updates
await a.execute({ type: "click", element_id: "nope" });              // expect status:"failed", error:"element_not_found..."
await a.execute({ type: "fill", element_id: "save_project_button", value: "x" }); // expect unsupported_element
```

Checks:
- `observe()` shows only *visible* elements — modal fields must disappear from the map after save/cancel.
- `fill` must actually update React state (typed via the native value setter + input/change events).
- Failed actions return `{status:"failed", error, page}` — never throw into the caller's loop.
