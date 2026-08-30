# Navex

An embeddable AI agent that executes tasks inside web apps through a strict,
validated UI-action loop (`navigate / click / fill / select / submit`). It
operates any page whose components are tagged with stable **`data-waid`**
element IDs — that contract is what makes a component "AI accessible" (see
[Making components AI accessible](#making-components-ai-accessible)).

This repo contains **Phase 0–6** of the MVP plan:

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
- `sdk/` — embeddable chat widget + agent client (`WebAgent.init`), DOM
  observer (`observe()`), action executor, turn driver with client-side step
  guard, and the `window.__navex` dev harness.

---

## Quickstart

**Prerequisites**

- Python 3.11+
- Node.js 18+ and npm

**1. Start the backend** (port 8000)

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # defaults run in FakeLLM mode — no API key needed
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

- Health check: http://localhost:8000/api/health
- Swagger docs: http://localhost:8000/docs
- Tests: `.venv/bin/pytest -q`

**2. Start the demo app** (port 5173)

```bash
cd demo-app
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :8000)
```

**3. Try it**

Click the floating ✦ launcher (bottom-right) and type:

> Create a project called Alpha.

The page should navigate to Projects, open the modal, fill the name, save, and
the widget should confirm completion. That's the full loop working end to end.

---

## Configuration reference

All settings are read from `backend/.env`, prefixed with `NAVEX_` (see
`backend/app/config.py`). Copy `backend/.env.example` to start:

```bash
cd backend && cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `NAVEX_DEV_KEY` | `dev-key-123` | Bearer token required on all API routes except `/api/health`. Must match the `apiKey` passed to `WebAgent.init`. |
| `NAVEX_USE_FAKE_LLM` | `true` | `true` = scripted FakeLLM (no key, deterministic golden path). `false` = call a real model. |
| `NAVEX_LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible endpoint. |
| `NAVEX_LLM_API_KEY` | *(empty)* | Provider key (`NAVEX_OPENROUTER_API_KEY` also accepted). |
| `NAVEX_LLM_MODEL` | `openai/gpt-4o-mini` | Model name for the configured provider. |

When `NAVEX_USE_FAKE_LLM=false`, set `NAVEX_LLM_API_KEY` to your provider key.
See [Using a different LLM provider](#using-a-different-llm-provider).

---

## How the loop works (server side)

1. `POST /api/sessions` → `{session_id}`
2. `POST /api/chat {session_id, message}` → either
   `{type:"action", step, action}` or `{type:"final", reason, message}`
3. SDK executes the action in the browser and posts the fresh DOM state to
   `POST /api/agent/observation {session_id, result:{status, page}}`
4. Repeat step 2↔3 until `final`

Every proposed action is validated server-side against the page registry and
the latest observed UI state before it is ever returned to the browser;
invalid proposals are fed back as corrections (bounded retries).

---

## Embedding the agent (Phase 6)

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

---

## Making components AI accessible

The agent interacts with your app through a **two-part, explicit contract**.
There is no magic — tag an element, register a page, and the LLM can operate
both.

| # | Where | What you do |
|---|---|---|
| 1 | `demo-app/` | Add a stable `data-waid` id to the element |
| 2 | `demo-app/` | Give the element a readable label |
| 3 | `backend/app/data/demo_site.json` | Register the page (description + optional notes) |

### 1. Tag the element

Add one attribute — `data-waid="unique_snake_id"` — to any `form`, `input`,
`textarea`, `select`, `button`, checkbox, or radio you want the agent to use.

```tsx
<button data-waid="create_project_button" onClick={openModal}>
  + Create Project
</button>
```

The agent-facing type is inferred automatically from the tag
(`sdk/src/observer.ts:51`), so you never declare it:

| Tag / attribute | Exposed type | Agent can |
|---|---|---|
| `<button>`, `<a>`, `<div>` (any other element) | `button` | `click` |
| `<input type="text\|search\|email\|password\|tel\|url\|number">` | `input` | `click`, `fill` |
| `<textarea>` | `textarea` | `click`, `fill` |
| `<select>` (with `<option>`s) | `select` | `click`, `select` |
| `<input type="checkbox">` | `checkbox` | `click` |
| `<input type="radio">` | `radio` | `click` |
| `<form>` | `form` | `submit` |

A short example covering several types:

```tsx
<form data-waid="new_project_form" onSubmit={handleSubmit}>
  <label htmlFor="project-name">Project Name</label>
  <input
    data-waid="project_name_input"
    id="project-name"
    type="text"
    placeholder="e.g. Alpha"
    value={name}
    onChange={(e) => setName(e.target.value)}
  />

  <label htmlFor="project-priority">Priority</label>
  <select data-waid="priority_select" id="project-priority" value={priority} onChange={...}>
    <option value="High">High</option>
    <option value="Medium">Medium</option>
    <option value="Low">Low</option>
  </select>

  <button type="submit" data-waid="save_project_button" className="primary">
    Save Project
  </button>
</form>
```

### 2. Give it a readable label

The label is the text the LLM reads to choose an element. It is resolved in
priority order (`sdk/src/observer.ts:26`):

1. `aria-label`
2. a wrapping `<label>` element's text
3. a `<label for="...">` bound by the element's `id`
4. the element's own text content
5. the `placeholder`
6. the `name` attribute

For inputs, prefer a visible `<label>` (helps accessibility too); provide
`aria-label` only when there's no visible text.

### 3. Register the page

`navigate` actions only succeed for paths registered in
`backend/app/data/demo_site.json`. Each page has:

- `description` — one line telling the LLM *what this page can do*, so it can
  route the right request here (e.g. "Lists all projects with a live search
  filter...").
- `notes` — optional step-by-step workflow hints the LLM follows once on the
  page (e.g. "Creating a project: click `create_project_button` to open the
  form...").

```jsonc
{
  "site": "demo-app",
  "pages": [
    {
      "path": "/projects",
      "description": "Lists all projects with a live search filter. Contains the Create Project button which opens the project creation form.",
      "notes": "Creating a project: click create_project_button to open the form, fill project_name_input (required), optionally choose priority_select (High/Medium/Low), then click save_project_button. Cancel with cancel_project_button."
    }
  ]
}
```

These become the **AVAILABLE PAGES** section of the LLM prompt
(`backend/app/agent/prompts.py:47`), and each new observation sends the
visible elements as `id | type | label` lines. The server validator rejects
any action against an unregistered path or an unknown/absent id
(`backend/app/agent/validator.py:34`).

### 4. Verify

With the demo app running, open DevTools on http://localhost:5173 and call
`window.__navex.observe()` — the result shows exactly what the agent will see:

```js
await window.__navex.observe();
// { path: "/projects", title: "...", elements: [ { id: "create_project_button", type: "button", label: "+ Create Project" }, ... ] }
```

If your new element isn't in the list, it isn't AI accessible yet — fix the
things below and re-check.

### Pitfalls & checklist

- **Unique, stable IDs** — one element per id per page; never re-render-context
  salts or indexes. If the id changes between turns, the agent gets
  `element_not_found` validation errors.
- **Visible only** — only *visible* elements are exposed (`sdk/src/observer.ts:19`).
  A modal's fields appear only while the modal is open; hidden or 0-size
  elements are invisible to the agent.
- **Disabled blocks** — elements with `disabled` or `aria-disabled="true"` are
  exposed but rejected for `click`/`fill`.
- **Select options come from `<option>`s** — the available options forwarded to
  the LLM are the option `value`s; anything else is rejected as
  `invalid_option`. Pass a human-readable `value` (e.g. `"High"`), not just a
  code.
- **Fillable inputs** — only `text/search/email/password/tel/url/number`
  inputs and textareas are fillable; checkboxes/selects are not. A `fill` on
  the wrong type returns `unsupported_element`.

---

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

---

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

---

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

---

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
