# Getting started

This guide takes you from a clean checkout to a running AgentOps instance and explains what you are looking at once it is up.

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer | The project pins `@types/node` to 20 and relies on `fetch`, `structuredClone` and `Intl.RelativeTimeFormat`, all available from Node 20. |
| pnpm | 9 or newer | `pnpm-workspace.yaml` is present only to allow native builds (`sharp`, `unrs-resolver`); there are no workspace packages. |
| A browser | Any current Chromium, Firefox or Safari | The app stores a small amount of state in `localStorage`. |

No database, API key or external service is required. The only network call the app makes on its own is the public OpenRouter model list, and it is optional.

## Install

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The root route redirects to `/dashboard`.

## Scripts

Every script in `package.json` and what it does:

| Script | Command | What it does |
| --- | --- | --- |
| `pnpm dev` | `next dev` | Starts the Turbopack dev server on port 3000. Routes compile on first visit. |
| `pnpm dev:warm` | `next dev & node scripts/warm.mjs; wait` | Starts the dev server and, in the same terminal, pre-compiles every route so the first click on each page is fast. |
| `pnpm warm` | `node scripts/warm.mjs` | Pre-compiles routes against an already running dev server. The route list is derived from `app/(app)/**/page.tsx` by `scripts/warm-routes.mjs`; dynamic segments get one real record id from `SAMPLE_IDS`. Honours `WARM_BASE` (default `http://localhost:3000`) and `WARM_CONCURRENCY` (default 2). Waits up to 120 s for the server to answer. |
| `pnpm build` | `next build` | Production build into `.next/`. |
| `pnpm start` | `next start` | Serves the production build. Run `pnpm build` first. |
| `pnpm lint` | `eslint` | ESLint 9 flat config: Next core-web-vitals and TypeScript rules plus the full `jsx-a11y` recommended set. `components/ai-elements/**` has relaxed rules because it is vendored. |
| `pnpm test` | `vitest run` | Runs the unit test suite once in jsdom (27 files, 246 tests). |
| `pnpm test:watch` | `vitest` | Same suite in watch mode. |
| `pnpm format` | `prettier --write "**/*.{ts,tsx}"` | Formats every TypeScript file at the repo's 80-column config with the Tailwind class sorter. |
| `pnpm typecheck` | `tsc --noEmit` | Type-checks the whole project without emitting. |

Before you hand off a change, run `pnpm typecheck && pnpm lint && pnpm test`.

## First run walkthrough

1. `/` redirects to `/dashboard`, the Workspace overview. The top row shows fleet health, spend, review queue depth, drift and failing evals; incidents and changes follow below.
2. The sidebar groups every page into Workspace, Agent Operations, Build, Govern, Service Management, Service Health and Administration. Hover an item to see its "G then key" shortcut.
3. Open Agent Operations, then Fleet Overview (`/agentops`). Eight deployed agents are listed, from Support Triage (`agt-support-triage`) to Finance Copilot (`agt-finance-copilot`). Click one to open its record with graph, metrics, SLO card, prompt, tools, traces and configuration. Every page has the same header (eyebrow, icon and title from the sidebar entry) and a row of compact stat cards; sidebar badges (Approvals, Review Queue, Recommendations, Workflow Automations, Alerts) are live counts from the same data.
4. Open Traces. 140 runs are generated with spans; click any `tr_` id to see the waterfall.

### Where the data comes from

Everything you see is deterministic sample data under `lib/data/`. Each module seeds its own pseudo-random generator (`createRng(seed)` in `lib/data/seed.ts`) and anchors every timestamp to a fixed clock, `NOW = 2026-11-05T14:30:00Z`, read through `clock()`. That is why the data is identical on the server and in the browser, identical across reloads, and why "2 hours ago" never drifts. Today's fleet spend in the sample is $571.20 across 16,341 requests.

The sample workspace is **Acme Corp** (`siteConfig.workspace`). The sample platform owner is **Kevin Dargas** (`kevin.dargas@agentops.dev`, user `u-001`); he owns several agents, budgets and API keys and appears as the default actor in the audit log. The rest of the directory (service desk lead, infrastructure, change manager, network, DBA, HR and others) lives in `lib/data/users.ts`.

Edits you make in the UI (approving a review, acknowledging a drift signal, pausing an agent, promoting a variant, creating an incident) are held in module-scoped client stores (`createListStore` in `lib/store.ts`) and confirmed with a toast. Within the session every table, stat card and badge that shows the record moves together, and audit records you cause are appended to the Audit Log marked "This session". Nothing is written to disk: a reload returns to the seed. The exceptions are listed under Browser storage below.

## Environment variables

There are none. `next.config.ts` is empty and no code reads `process.env` except the warm script's `WARM_BASE` and `WARM_CONCURRENCY`.

The Model Catalog (`/ai/models`) is the only page with live data. It fetches `https://openrouter.ai/api/v1/models` server-side without a key and caches the response for one hour through `next.revalidate`. If the fetch fails (offline, blocked egress, provider outage) the page renders an empty state with the error message; nothing else in the app depends on it.

## Keyboard shortcuts

Shortcuts are defined in `config/site.ts` and `config/nav.ts`. Single-key handlers (`C`, `D`, `G` chords) live in `components/layout/command-menu.tsx`; `Cmd/Ctrl B` is in the sidebar provider and `Cmd/Ctrl J` in the AI provider. Single keys are ignored while you type in an input, textarea, select or contenteditable, while a dialog, sheet, menu, the command palette or the assistant panel has focus, when a modifier is held, and when a page has claimed the key with `event.preventDefault()` (the review queue claims `A`, `F`, `C`, `S`, `1` to `5`, `Enter` and `Esc`, so `C` there corrects instead of opening quick create). `config/nav.test.ts` guarantees every chord letter is unique.

| Keys | Action |
| --- | --- |
| Cmd/Ctrl + K | Open or close the command menu (search pages and records, quick actions, theme) |
| Cmd/Ctrl + J | Toggle the AgentOps Assist panel |
| Cmd/Ctrl + B | Toggle the sidebar |
| C | Open quick create (incident, change, service request, problem, knowledge article). Incident, change, problem and article open their create sheet through `?new=1`; service request goes to the catalog |
| D | Toggle dark mode (handled in the command menu, with the cross-fade from `components/theme-provider.tsx`) |
| G then D | Overview dashboard |
| G then W | My Work |
| G then A | Approvals |
| G then N | Analytics |
| G then O | Fleet Overview |
| G then R | Review Queue |
| G then P | Prompts |
| G then L | Playground |
| G then T | Tools & MCP |
| G then X | Workflow Automations |
| G then G | Guardrails |
| G then E | Evals & Datasets |
| G then Y | Readiness Assessment |
| G then I | Incidents |
| G then C | Changes |
| G then Q | Requests |
| G then K | Knowledge |
| G then H | Service Health |
| G then S | Settings |

Inside the Review Queue: A approve, F flag, C correct, S skip, 1 to 5 fills the next empty rubric criterion, Enter saves a correction, Esc cancels it. Cmd/Ctrl + , opens Settings.

## Deployment notes

- **Vercel or Netlify**: deploy the repository as a standard Next.js app. No environment variables are needed. The OpenRouter fetch runs in a server function and benefits from the one-hour revalidation.
- **Static export**: set `output: "export"` in `next.config.ts` to produce a static site (GitHub Pages and similar). The readiness assessment is fully client-rendered and works unchanged. The Model Catalog loses its server runtime; with a static export the catalog fetch runs at build time and the result is frozen into the page.
- **Self-hosted**: `pnpm build && pnpm start` behind any reverse proxy.
- The app has no authentication layer. Treat it as an internal tool or add your own middleware before exposing it.

See [development/deployment.md](development/deployment.md) for more.

## Browser storage

The app keeps a few things in `localStorage`. Clearing site data resets all of them. Everything else (review decisions, created records, paused agents, session audit records) lives in in-memory stores and resets on reload.

| Key | Written by | Contents |
| --- | --- | --- |
| `agentops.readiness.v1` | `lib/readiness/store.ts` | The current readiness assessment, snapshots (up to 25), the "show not applicable" toggle, your respondent name for team mode and an imported control set, if any. The Share tab's reset action removes this key. |
| `agentops:theme` | `components/theme/customizer-provider.tsx` and the inline script in `lib/theme-presets.ts` | Theme customizer settings: accent, radius, density, surface and sidebar variant. Applied before first paint and validated against the known ids. |
| `agentops:assistant` | `components/ai/ai-provider.tsx` | Whether the assistant panel is open and which tab (chat, agents, queue) is active. |
| `agentops:ai-settings` | `components/ai/ai-provider.tsx` | Assistant settings: picked model, pinned catalog model, default autonomy, approval for high-risk actions, PII redaction, daily action budget, allowed tools, show reasoning. |
| `theme` | `next-themes` | Light, dark or system preference. |

One cookie is also set: `sidebar_state` (`components/ui/sidebar.tsx`, 7-day max age) remembers whether the sidebar is open so the server can render the correct width on first paint.

Nothing is ever sent to a server from any of these stores.

## Metadata

`app/layout.tsx` sets the document metadata from `config/site.ts`: the tab title uses the template `%s · AgentOps` (each page exports its own `title`), the description and Open Graph card come from `siteConfig.description` and `siteConfig.tagline`, `metadataBase` is `siteConfig.url` (set `NEXT_PUBLIC_SITE_URL` when you deploy), the icons are `public/favicon.svg` and `app/favicon.ico`, and `robots` is `noindex`. Those three files are the brand swap points.
