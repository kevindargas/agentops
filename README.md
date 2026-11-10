# AgentOps

A UI template for operating an agentic AI ecosystem. Deployed agents are treated like production services, with traces, human review, drift and quality monitoring, experiments, prompts, tools, guardrails, evals, releases, budgets and a readiness assessment, next to the incident, change and service-health workflows those agents plug into. Built in the shadcn/ui style: every component lives in your codebase, is themed through CSS variables and can be edited freely. All data is deterministic sample data, so the app runs with no backend and no keys.

## Stack

| Layer     | Choice                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| Framework | Next.js 16 (App Router, React 19, Turbopack)                                               |
| UI        | shadcn/ui on Base UI primitives (`base-nova` preset), Tailwind CSS v4                      |
| Tables    | TanStack Table v9 (feature registry, tree-shaken)                                          |
| Charts    | Recharts 3 via shadcn `ChartContainer`, validated accessible palette (`--chart-1` to `-8`) |
| AI UI     | shadcn AI Elements (conversation, message, prompt input, tool, reasoning, suggestions)     |
| Icons     | Lucide                                                                                     |
| Theming   | CSS variables in OKLCH, `next-themes` light/dark/system, theme customizer                  |
| Toasts    | Sonner                                                                                     |
| Tooling   | TypeScript, ESLint 9, Prettier + Tailwind plugin, Vitest (27 files, 246 tests), pnpm       |

## Getting started

Node 20 or newer and pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:3000 (redirects to /dashboard)
pnpm dev:warm   # dev server plus background pre-compilation of every route
pnpm warm       # pre-compile routes against an already running dev server
pnpm build      # production build
pnpm start      # serve the production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint (Next rules plus jsx-a11y recommended)
pnpm test       # vitest run (jsdom)
pnpm test:watch # vitest in watch mode
pnpm format     # prettier --write
```

No environment variables are required. The Model Catalog fetches the public OpenRouter model list server-side and degrades to an empty state offline. Full details in [docs/getting-started.md](docs/getting-started.md).

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Cmd/Ctrl + K | Command menu (pages, records, actions) |
| Cmd/Ctrl + J | AgentOps Assist panel |
| Cmd/Ctrl + B | Toggle sidebar |
| Cmd/Ctrl + , | Settings |
| C | Quick create (incident, change, problem and article open their create sheet; service request goes to the catalog) |
| D | Toggle dark mode |
| G then a letter | Jump: D overview, W my work, A approvals, N analytics, O fleet, R review queue, P prompts, L playground, T tools, X automations, G guardrails, E evals, Y readiness, I incidents, C changes, Q requests, K knowledge, H service health, S settings |

Single keys stand down while you type, inside dialogs, sheets, menus, the command palette and the assistant panel, and when a page has claimed the key (the Review Queue uses A, F, C, S, 1 to 5, Enter and Esc). Chord letters are unique; a test enforces it.

## What's included

**Agent Operations.** Fleet Overview with traffic, quality, spend, review volume, outcomes, telemetry health and emergency controls (kill switch, writes disabled, both behind a confirmation); Agents with model, tools, owner, health, drift score, run limits, SLO and error budget, a rendered state graph and a configuration panel linking to the agent's guardrails, knowledge bases and budget by id; Traces with spans, tokens, cost, evaluator scores, outcome, flags and lineage in a waterfall; Review Queue with a four-criterion rubric and keyboard-driven approve / flag / correct / skip (58 items, 36 pending in the sample); Drift & Quality signals against each agent's baseline; Experiments with per-variant metrics, a 0.95 significance threshold and confirmed promote and stop; Recommendations backed by shadow evals and experiments that draft an A/B test at the default 20 percent split. Docs: [features/agent-operations](docs/features/agent-operations/README.md).

**Build.** Prompts registry with immutable versions, labels, line-level diff, attached guardrails and per-version parameters; Playground with the full generation-parameter editor, deterministic simulated runs, A/B compare and save-as-version; Tools & MCP with JSON-schema tools, risk and approval policy, MCP server integrity and an agents x risk permission matrix exported as a real `tool-policy.json`; Knowledge & Memory with vector indexes, ingestion, memory stores and retrieval quality; Semantic Layer of governed metrics and entities; Model Catalog backed by live OpenRouter data; Workflow Automations with internal agents, autonomy levels and an approval queue. Docs: [features/build](docs/features/build/README.md).

**Govern.** Guardrails as policy-as-code with violations, coverage and an offline tester; Evals & Datasets with runs, case grids, golden datasets, eight evaluator types and release gates at a composite of 85; Deployments with canary (5, 25, 100), blue-green, shadow and direct releases, rollout chart, environments matrix, approvals and gate reasons; Audit Log as an append-only hash chain of 140 seeded events that your own session actions extend; Schedules & Triggers with cron, event and webhook triggers and freeze windows; Providers & Routing with scoped keys and a rotation grace period, five routing strategies and rate limits; Costs & Budgets with budgets, breach actions, forecast, savings and a CSV export; Readiness Assessment scoring 86 controls across six domains with framework mappings and shareable results. Docs: [features/govern](docs/features/govern/README.md).

**Workspace.** Overview dashboard, My Work, Approvals (one shared approval store with the change record) and Analytics. Docs: [features/workspace](docs/features/workspace/README.md).

**Service Management.** Incidents, Problems, Changes (with calendar, CAB view and the shared freeze windows), Requests (REQ, RITM, SCTASK), Service Catalog and Knowledge, each with a create sheet reachable from quick create (`?new=1`) and a per-module session store. The systems and services agents depend on live in `lib/data/cmdb.ts` as an internal data source; there is no inventory page. Docs: [features/service-management](docs/features/service-management/README.md).

**Service Health.** Business service health and availability against a 99.9 percent SLO, and Alerts with a detail sheet (`?alert=`) and bulk actions. Docs: [features/service-health](docs/features/service-health/README.md).

**Administration.** Users & Groups and Settings. Docs: [features/administration](docs/features/administration/README.md).

**Assistant and shell.** AgentOps Assist docked panel with streamed reasoning, tool calls and one-click actions, a model picker, a library of agentic templates, AI insights on records, a global command menu with server-built record search, quick create, notifications, breadcrumbs, live sidebar badges, loading skeletons on every list and record route, a collapsible sidebar and a theme customizer with six style presets. The assistant is a scripted engine in `lib/ai/assistant.ts`, so the UI runs without an API key. Docs: [features/assistant-and-shell.md](docs/features/assistant-and-shell.md).

**One dialect everywhere.** Every page renders `PageHeader` (title, icon and eyebrow resolved from the nav entry), a `StatGrid` of compact stat cards without icons whose deltas are derived from the data, shared sheet frames and skeletons, and tokens instead of palette classes. Client-side edits go through module-scoped session stores (`createListStore`), so a decision on one surface moves every number that shows it until you reload; toasts describe only what actually changed; destructive actions ask for confirmation; every deep link targets a query parameter that is read.

## Documentation

- [Documentation index](docs/README.md)
- [Operator checklist](docs/operator-checklist.md): daily, weekly, pre-release and quarterly checks
- [Knowledge base](docs/knowledge-base/README.md): glossary, concepts, FAQ, troubleshooting, runbooks
- [Development guide](docs/development/architecture.md): architecture, conventions, adding a module, theming, testing, wiring real data, deployment

## Project structure

```
app/
  layout.tsx            Root: fonts, metadata (title template, icons, Open Graph), providers, Toaster
  page.tsx              Redirects to /dashboard
  global-error.tsx      Root error boundary
  favicon.ico           Legacy icon (public/favicon.svg is primary)
  (app)/layout.tsx      App shell (sidebar + header) for every module; nav counts and search index
  (app)/error.tsx       In-shell error boundary
  (app)/loading.tsx     Neutral page skeleton
  (app)/<module>/...    Route segments per module (agentops, ai, itsm, itom, admin, dashboard, my-work,
                        approvals, analytics, settings); list and record routes carry their own loading.tsx
components/
  ui/                   shadcn/ui primitives (generated, editable)
  ai-elements/          shadcn AI Elements (vendored registry code)
  ai/                   AiProvider, AssistantPanel (lazy-loaded), ModelPicker, TemplateMenu, agent and proposal cards, RecordAiInsights
  theme/                CustomizerProvider and ThemeCustomizer
  theme-provider.tsx    next-themes wrapper and cross-fade (the D hotkey is in layout/command-menu.tsx)
  layout/               app-shell, app-frame, app-sidebar, site-header, breadcrumbs, command-menu (keyboard
                        contract, chords, C, D), notifications, quick-create, nav-user, search-index
  data-table/           Generic TanStack v9 DataTable, column header hints, facets, pagination, view options
  record/               RecordHeader, EditableTitle, RecordTabs (?tab=), RecordLayout, ActivityStream, RelatedList,
                        lifecycle, SLA progress
  shared/               PageHeader, StatGrid, StatCard / StatDelta, MetricTile, Eyebrow, CountPill, sheet-frame,
                        skeletons, StateBadge / PriorityBadge, DetailList, UserChip, EmptyState, CopyButton, RecordLink
  charts/               ChartCard, chart-primitives (CHART_HEIGHT), trend, bar, horizontal bar, stacked bar, donut,
                        sparkline, uptime strip, availability bar, period select, incident trend, rollout chart,
                        coverage radar, domain heatmap
config/                 nav.ts (groups, chords, badge keys, findNavItem / findNavGroup, quick create),
                        nav-counts.ts (live sidebar counts), site.ts (name, workspace, shortcuts)
features/<module>/      Module-specific columns, tables, forms, sheets, actions and a <module>-store.ts
features/agentops/      Fleet overview, agents and traces tables, trace waterfall, agent graph, review queue,
                        drift board, experiments, recommendations, semantic layer and stores.ts (shared session
                        stores); one folder per control surface: prompts, playground, agent-config, tools,
                        knowledge, guardrails, evals, deployments, schedules, providers, costs, audit, readiness,
                        each with its own store.ts
features/ai/            Workflow automations control center and the OpenRouter model catalog
hooks/                  use-mobile, use-query-param (shared ?param= read and replaceState write)
lib/
  types.ts              Domain model (DeployedAgent, AgentTrace, ModelParams, Incident, Change, ...)
  constants.ts          State lists, priority matrix, SLA targets, cabSchedule, reminder windows
  format.ts             Dates, currency, cost, tokens, latency, durations, model display names, anchored to the demo clock
  store.ts              createStore (persisted) and createListStore (session lists)
  theme-presets.ts      Accent, radius, density, surface and sidebar presets, storage key, init script
  data/                 Deterministic sample data (seeded PRNG, fixed clock NOW and clock()); one module per
                        feature, each exporting its own types and count helpers; metrics.ts (period deltas),
                        agent-config.ts, cmdb.ts is the internal systems list
  ai/                   agents.ts (workflow agents, proposals, curated models), assistant.ts (scripted engine),
                        templates.ts, guardrails.ts, openrouter.ts (types, normaliser), openrouter.server.ts
  readiness/            Readiness engine: types, controls (base + wave-2 files), frameworks, tools, metrics,
                        snippets, library, scoring, codec (JSON / CSV / Markdown / URL), store
public/favicon.svg      Primary icon
scripts/
  warm.mjs              Route pre-compiler for the dev server
  warm-routes.mjs       Derives the route list from app/(app)/**/page.tsx and SAMPLE_IDS
test/setup.ts           Vitest setup: jsdom stubs and next/navigation mock
docs/                   Documentation (this README links into it)
```

## Contributing

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm format
```

Read [docs/development/conventions.md](docs/development/conventions.md) first: Base UI not Radix, `render` prop not `asChild`, TanStack v9 feature registry and `sortFn`, `clock()` and `timeAgo` for every timestamp, `stateTone` and chart tokens for every colour, `PageHeader nav=` and `StatGrid` on every page, `createListStore` for every client-mutable list, truthful toasts and confirmed destructive actions, deep links that are read, `ModelParams` edited only through `ParamEditor`, stable readiness control ids, and an audit event for every mutation. Add tests next to the code as `*.test.ts(x)`; the suite is 27 files and 246 tests.

## License

MIT
