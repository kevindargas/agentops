# Architecture

AgentOps is a Next.js 16 App Router application written in TypeScript with React 19, Tailwind CSS v4 and shadcn/ui on Base UI primitives. It ships with deterministic sample data and one live integration. This page describes how the pieces fit so you can change one without surprising another.

## Folder layout

```
app/                      Routes. Server components by default.
  layout.tsx              Root: fonts, metadata (title template, icons, Open Graph), ThemeProvider,
                          CustomizerProvider, TooltipProvider, AiProvider, Toaster, theme init script
  page.tsx                Redirects / to /dashboard
  not-found.tsx           Root not-found
  global-error.tsx        Root error boundary (self-contained, no app shell)
  favicon.ico             Legacy icon; public/favicon.svg is the primary one
  (app)/layout.tsx        App shell for every module; reads the sidebar cookie, computes nav counts
                          and the record search index on the server
  (app)/error.tsx         In-shell error boundary
  (app)/loading.tsx       Neutral PageSkeleton for routes without their own loading.tsx
  (app)/not-found.tsx     In-shell not-found
  (app)/agentops/...      Agent Operations, Build and Govern pages; list routes carry loading.tsx
                          (TableSkeleton), [id] routes carry loading.tsx (RecordSkeleton)
  (app)/ai/...            Workflow Automations (/ai) and Model Catalog (/ai/models)
  (app)/itsm/...          Incidents, problems, changes, requests, catalog, knowledge
  (app)/itom/...          Service health and alerts
  (app)/admin/users       Users & Groups
  (app)/dashboard, my-work, approvals, analytics, settings
components/
  ui/                     shadcn/ui primitives (generated, editable)
  ai-elements/            Vendored shadcn AI Elements
  ai/                     AiProvider, AssistantPanel, ModelPicker, TemplateMenu, cards, RecordAiInsights
  theme/                  CustomizerProvider, ThemeCustomizer
  theme-provider.tsx      next-themes wrapper, cross-fade (the D hotkey lives in layout/command-menu.tsx)
  layout/                 AppShell, AppFrame, AppSidebar, SiteHeader, Breadcrumbs, CommandMenu
                          (keyboard contract, chords, C and D), Notifications, QuickCreate, NavUser,
                          search-index.ts (record search built on the server)
  data-table/             Generic TanStack v9 DataTable, column header with hints, facets,
                          pagination, view options, features registry, DataTableSkeleton re-export
  record/                 RecordHeader, EditableTitle, RecordTabs (?tab= sync), RecordLayout,
                          RecordSection, ActivityStream, RelatedList, lifecycle, SLA progress
  shared/                 PageHeader (nav prop), StatGrid, StatCard / StatDelta, MetricTile, Eyebrow,
                          CountPill, sheet-frame (SheetBody, SheetFooterActions, sheetWidths),
                          skeletons (TableSkeleton, RecordSkeleton, PageSkeleton), StateBadge,
                          DetailList, UserChip, EmptyState, CopyButton, RecordLink / recordHref
  charts/                 ChartCard, chart-primitives (CHART_HEIGHT), trend, bar, horizontal bar,
                          stacked bar, donut, sparkline, uptime strip, availability bar, period
                          select, incident trend, rollout chart, coverage radar, domain heatmap
config/                   nav.ts (groups, chords, badge keys, findNavItem / findNavGroup, quick
                          create), nav-counts.ts (getNavCounts), site.ts (name, workspace, shortcuts)
features/                 Module-specific UI: columns, tables, forms, sheets, actions, stores
  agentops/               Agent Operations surfaces plus one folder per Build and Govern feature;
                          stores.ts holds the shared client stores for the Agent Operations slice
  agentops/<feature>/     prompts, playground, agent-config, tools, knowledge, guardrails, evals,
                          deployments, schedules, providers, costs, audit, readiness; each with its
                          own store.ts where the page mutates
  ai/                     Control center and model catalog
  incidents, problems, changes, requests, catalog, knowledge, itom, admin, workspace
                          Each with a <module>-store.ts created by createListStore
hooks/                    use-mobile, use-query-param (shared ?param= read/write)
lib/
  types.ts                Domain model
  constants.ts            State lists, priority matrix, SLA targets, cabSchedule, reminder windows
  format.ts               Dates, currency, cost, tokens, latency, durations, model display names
  store.ts                createStore (persisted) and createListStore (session lists), useMediaQuery
  theme-presets.ts        Customizer presets, storage key, init script
  data/                   Deterministic sample data, one module per feature; seed.ts (NOW, clock(),
                          createRng), metrics.ts (period deltas), agent-config.ts, index.ts barrel
  ai/                     agents.ts, assistant.ts, templates.ts, guardrails.ts, openrouter.ts,
                          openrouter.server.ts
  readiness/              Readiness engine: types, controls, frameworks, tools, metrics, snippets,
                          library, scoring, codec, store
public/favicon.svg        Primary icon referenced from app/layout.tsx metadata
scripts/
  warm.mjs                Route pre-compiler for the dev server
  warm-routes.mjs         Derives the route list from app/(app)/**/page.tsx and SAMPLE_IDS
test/
  setup.ts                Vitest setup: jsdom stubs and next/navigation mock
  data-barrel.test.ts     Barrel completeness
```

## Route groups

Everything users see lives under the `(app)` route group so it shares one layout: `app/(app)/layout.tsx` reads the `sidebar_state` cookie, calls `getNavCounts()` and `buildSearchIndex()` on the server, and renders `AppShell`, which renders `AppFrame` (sidebar, header, main content, lazy assistant panel, command menu). The root `app/layout.tsx` only sets up metadata, providers and fonts, so `global-error.tsx` can render without the shell.

Record routes use dynamic segments: `agentops/agents/[id]`, `agentops/traces/[id]`, `agentops/prompts/[id]`, `agentops/evals/[id]`, `agentops/deployments/[id]`, `itsm/incidents/[number]` and so on. In this Next version `params` and `searchParams` are Promises; server components `await` them. Every list route and every record route has a `loading.tsx` so the transition shows a `TableSkeleton` or `RecordSkeleton` in the same frame the real content will occupy; `app/(app)/loading.tsx` covers the rest with `PageSkeleton`.

## Server versus client components

Pages are server components. They import from `lib/data`, call the getter they need, and pass plain data into feature components. Feature components that hold state, read the URL or attach handlers are client components (`"use client"`). The rule of thumb: `app/**/page.tsx` fetches, `features/**` interacts, `components/**` is reusable and knows nothing about the domain.

Client components import the specific data module they need (`@/lib/data/agentops`), never the `@/lib/data` barrel, so a client bundle only carries the fixtures it renders. Client components that read the URL use `useQueryParam(name)` from `hooks/use-query-param.ts` (a `useSearchParams` read inside a `<Suspense>` boundary plus a `history.replaceState` write), so sheet open state and active tabs change the URL without a server round trip.

## Shared primitives layer

`components/shared/` is the dialect every page speaks:

- `PageHeader nav=` resolves title, icon and eyebrow from `config/nav.ts` through `findNavItem` and `findNavGroup`.
- `StatGrid` plus `StatCard` (no icons, `size="sm"` injected) is the KPI row; `StatDelta` renders deltas computed by `lib/data/metrics.ts`. `MetricTile` is the inline variant for cards, sheets and sidebars.
- `Eyebrow` and `CountPill` standardise the small uppercase labels and count badges.
- `sheet-frame.tsx` fixes sheet widths (`detail`, `editor`), the scroll region (`SheetBody`) and the button order (`SheetFooterActions`).
- `skeletons.tsx` provides `TableSkeleton`, `RecordSkeleton` and `PageSkeleton` for Suspense fallbacks and `loading.tsx` files.
- `status-badge.tsx` maps every state string to a tone (`stateTone`); `record-link.tsx` maps every id prefix to a route (`recordHref`).

`components/record/` builds on it for record pages: `RecordHeader` (title optionally through `EditableTitle`), `RecordTabs` (reads and writes `?tab=` unless `syncParam={null}`), `RecordLayout`, `ActivityStream`, `RelatedList`.

## Data flow

```
lib/data/<feature>.ts   ->   app/(app)/.../page.tsx   ->   features/<module>/*.tsx   ->   components/*
(deterministic data)        (server, awaits data)         (client, store state)          (presentation)
```

`lib/data/index.ts` re-exports every module so server pages can import from `@/lib/data`; two tests (`lib/data/barrel.test.ts`, `test/data-barrel.test.ts`) keep the barrel complete and flag name collisions. Each module exports its own types alongside its data (for example `Guardrail` from `lib/data/guardrails.ts`), while the core domain types (`DeployedAgent`, `AgentTrace`, `ModelParams`, ITSM records) live in `lib/types.ts`. `lib/data/metrics.ts` derives period-over-period comparisons from the records; `lib/data/agent-config.ts` assembles the agent record's configuration panel from budgets, guardrails, knowledge bases and schedules by id. `lib/data/integrity.test.ts` checks that every id-like field across every module resolves.

## Stores layer

Mutations in the sample app are session-local but shared. `createListStore(seed, getId)` in `lib/store.ts` wraps a seeded list in a `useSyncExternalStore` store with `use`, `get`, `subscribe`, `set`, `patch`, `add`, `remove` and `reset`. Stores are created once at module scope:

- `features/agentops/stores.ts`: `agentStore`, `reviewStore`, `driftStore`, `experimentStore`, `recommendationStore`, `semanticStore`, plus the factories `queueTraceForReview` and `draftExperiment`.
- `features/agentops/<feature>/store.ts` (and `prompts/prompt-store.ts`, `audit/audit-store.ts`, `playground/applied-config-store.ts`) for the Build and Govern pages.
- `features/<module>/<module>-store.ts` for incidents, problems, changes, requests, knowledge, alerts, users and the shared `features/workspace/approvals-store.ts`.

Every table, stat card, tab count and sheet on a page reads the same store, so one action moves every number; a reload returns to the seed because nothing is written to `localStorage`. The audit store is special: `auditStore.append` continues the seed's id sequence and hash chain, and `sessionAuditIds` marks the records added this session. See [wiring real data](wiring-real-data.md) for how to replace the stores with API calls.

## Deterministic data

Two primitives in `lib/data/seed.ts` make the sample data identical on every render:

- `NOW = new Date("2026-11-05T14:30:00Z")` and `clock()`, which returns it. Every timestamp is derived from it through `hoursAgo`, `daysAgo`, `hoursFromNow`, `daysFromNow`. `timeAgo()` and `formatUntil()` in `lib/format.ts` are relative to `NOW`. `clock()` is the one place to switch to the wall clock later.
- `createRng(seed)`, a mulberry32 generator. Each module calls it with a unique seed and draws from it in a fixed order, so adding a record at the end does not reshuffle the others. Helpers: `pick`, `weighted`, `int`, `chance`.

Never call `Date.now()`, `new Date()` or `Math.random()` in render or in data modules; it will produce a hydration mismatch. `lib/data/integrity.test.ts` also checks that no record is dated after the frozen clock.

## The persisted store pattern

`createStore(initial, storageKey?)` in `lib/store.ts` returns `{ subscribe, get, set, use }`. `use()` is `useSyncExternalStore(subscribe, get, () => initial)`: the server snapshot is always the initial value, the client loads `localStorage` lazily on first subscribe and emits in a microtask, so hydration matches and persisted state appears right after mount. Writes are JSON-serialised to the key and wrapped in `try/catch`.

Persisted stores in use: `readinessStore` (`agentops.readiness.v1`), the assistant UI and settings stores in `components/ai/ai-provider.tsx` (`agentops:assistant`, `agentops:ai-settings`). The theme customizer uses the same idea with its own provider plus an inline init script so attributes land before first paint (`agentops:theme`).

## Navigation, badges and search

`config/nav.ts` is the single source for the sidebar, the command menu, breadcrumb labels for known segments, "G then key" chords (`goToShortcuts`) and quick create items. Add a page there and all of them pick it up. `NavItem.badge` is a `NavBadgeKey`; `config/nav-counts.ts` turns the keys into numbers on the server from the same selectors the target pages use, so the sidebar badge and the page header always agree. `components/layout/search-index.ts` builds the command menu's record search (incidents, problems, changes, requests, articles, agents, semantic entities, prompts, releases, traces) on the server and passes a serialisable index down, so fixtures never ship in the client bundle. Record id prefixes that should render verbatim in breadcrumbs are listed in `components/layout/breadcrumbs.tsx`. `config/nav.test.ts` checks that chords are unique, every href has a page on disk and every badge key has a count.

## Keyboard handling

`components/layout/command-menu.tsx` owns every global single-key shortcut (`C`, `D`, `G` chords) and `shouldIgnoreShortcut(event)`, the contract that makes them stand down while typing, inside dialogs, sheets, menus, the command palette or the assistant panel, and when a page handler has called `event.preventDefault()`. `Cmd/Ctrl K`, `Cmd/Ctrl ,`, `Cmd/Ctrl B` (sidebar provider) and `Cmd/Ctrl J` (AI provider) are modifier chords and bypass the contract.

## Metadata and icons

`app/layout.tsx` builds `metadata` from `siteConfig`: `metadataBase` (`siteConfig.url`, override with `NEXT_PUBLIC_SITE_URL`), title template `%s · AgentOps`, description, `applicationName`, icons (`/favicon.svg` and `/favicon.ico`), Open Graph and Twitter cards and `robots: noindex`. Pages export `metadata = { title }` so the browser tab reads `Traces · AgentOps`.

## The readiness engine

`lib/readiness/` is self-contained: `controls.ts` merges the base controls with three wave-2 files and sorts by domain (86 controls); `scoring.ts` is the only place scores are computed; `codec.ts` is the only place state is serialised (JSON, CSV, Markdown, URL fragment); `store.ts` holds persisted client state; `features/agentops/readiness/shared.tsx` exposes `useReadiness()` so UI components never evaluate or persist on their own.

## Live integrations

There is one: the OpenRouter model catalog. `lib/ai/openrouter.server.ts` is server-only and fetches `https://openrouter.ai/api/v1/models` with `next: { revalidate: 3600 }`; it never throws and returns `{ models: [], error }` on failure. `lib/ai/openrouter.ts` holds the types, the normaliser and the formatters and is safe to import from client components. `/ai/models` renders the result; pinning a model stores a `CatalogModelRef` in `AiSettings.catalogModel`.

The assistant is not an integration. `planResponse` in `lib/ai/assistant.ts` is a scripted engine that produces an `AssistantRun` deterministically from the prompt and page context.

## Error boundaries

- `app/(app)/error.tsx` catches errors inside the shell and keeps the sidebar and header usable.
- `app/global-error.tsx` catches errors in the root layout and must render its own `<html>` and `<body>`; it imports nothing from the shell.
- `app/(app)/not-found.tsx` and `app/not-found.tsx` cover unknown routes; record pages call `notFound()` when a getter returns undefined and render `RecordNotFound`.

## Lazy-loaded assistant

`AppFrame` loads `AssistantPanel` with `next/dynamic` and `ssr: false`. The panel pulls in Streamdown, Shiki and the AI Elements stack; loading it on demand keeps those chunks out of every page's first paint. The closed panel renders nothing, so there is no layout shift. The trigger (Cmd/Ctrl + J, header button) and the persisted open state live in `AiProvider`, which is always mounted.

## Dev server warm-up

`scripts/warm.mjs` pre-compiles routes against a running dev server. The route list is not maintained by hand: `scripts/warm-routes.mjs` walks `app/(app)/**/page.tsx`, turns each directory into a route, and substitutes dynamic segments with one real record id from `SAMPLE_IDS`. `scripts/warm.test.ts` checks that every static route has a page, every dynamic segment has a sample id, and every sample id exists in the data modules.

## Tests

Twenty-seven test files sit next to the code they protect: data determinism and referential integrity (`lib/data/*.test.ts`, `features/*/**.test.ts`), the barrel, the count helpers and period deltas, the client stores (prompts, guardrails, audit), navigation and warm routes, the readiness engine, the audit chain, the assistant script, the OpenRouter normaliser, the data table and the status badge. See [testing](testing.md) for the table.
