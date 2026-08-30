# NAVEX Site Mapper (browser extension)

A **standalone NAVEX client** — installs on Chrome/Edge/Brave and works on any website, no SDK needed on the host site.

## What it does

1. **Scans** any page's DOM for interactive elements (buttons, links, inputs, textareas, selects, checkboxes, radios, forms).
2. **Injects** `data-waid` attributes so the agent can operate the page.
3. **Accumulates** a site map per origin as you browse — route changes and DOM mutations are watched and merged.
4. **Shows a floating chatbot** — users type a request, the agent executes actions directly on the page.
5. **Exports** the map as JSON, downloads it, or sends it to a NAVEX backend.

## Architecture

```
src/
├── content/
│   └── agent.ts          # agent loop: scan → runTurn → execute → observe
├── content.ts            # content script: scan, inject, history/MutationObserver
├── background.ts         # service worker: map persistence, HTTP relay
├── protocol.ts           # message types
├── schema.ts             # SiteMap/PageNode/UIElement schema
├── observer.ts          # reads [data-waid] elements into PageState
├── executor.ts          # executes navigate/click/fill/select/submit on the DOM
├── driver.ts            # turn loop: observe → execute → observe
├── client.ts            # HTTP client with relay transport
├── chat-widget.ts        # floating chat UI (shadow DOM)
├── types.ts             # AgentAction, PageState, TurnResponse, etc.
├── core/
│   ├── scanner.ts       # DOM → PageNode (unit-tested)
│   ├── ids.ts           # stable id generation + dedupe
│   ├── descriptors.ts    # heuristic descriptions
│   └── routes.ts        # internal-link collection, path normalization
└── popup/
    ├── popup.html       # scan/export/send controls + chat toggle
    └── popup.ts
```

## Workflow

```
User types request → extension scans page → sends site map to backend →
LLM decides action → extension executes in DOM → observes state →
repeat until task complete → user sees result in chat widget
```

## Build & load

```bash
cd extensions/site-mapper
npm install
npm run build           # → dist/
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `extensions/site-mapper/dist`

## Configure

1. Click the NAVEX icon
2. Set **Backend URL** (e.g. `http://localhost:8000`)
3. Set **API Key** (from `backend/.env`, default: `dev-key-123`)
4. Toggle **Enable Chat** ON
5. The floating ✦ chatbot appears on the page

## How it works end-to-end

1. Toggle **Enable Chat** → `SET_CHAT_ENABLED` → content script mounts the chat widget
2. User types a request in the chatbot
3. Extension scans the current page → injects `data-waid` → sends site map to backend (`SEND_FULL_MAP`)
4. Backend stores the map per-site; session is bound to that site
5. Backend's agent loop uses the uploaded map (not the default demo registry)
6. Validator returns hints when element ids are on different pages
7. Extension executes actions → observes state → reports back to backend
8. Loop repeats until task is complete or max steps reached

## Development

```bash
npm run typecheck         # tsc --noEmit
npm test                  # vitest — scanner core tests
npm run build             # production bundle
```
