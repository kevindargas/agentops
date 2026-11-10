# Contributor conventions

These are the rules the codebase follows. Most of them exist because a specific thing broke once. Read this before your first change and run `pnpm typecheck && pnpm lint && pnpm test` before you hand it off.

## What the product is

AgentOps is a UI for operating an agentic AI ecosystem. `features/agentops/` plus `lib/data/*.ts` are the product. The service-management modules (incidents, problems, changes, requests, catalog, knowledge) and Service Health (`/itom/health`, `/itom/alerts`) are the layer agents plug into. HR, CMDB UI, asset management, discovery and cloud pages were removed on purpose. `lib/data/cmdb.ts` stays as an internal data source (systems and services referenced by `ciId`) with no user-facing page; never link to `/cmdb/...`.

## Navigation groups

`config/nav.ts` defines the groups: Workspace, Agent Operations (fleet, agents, traces, reviews, drift, experiments, recommendations), Build (prompts, playground, tools & MCP, knowledge & memory, semantic layer, model catalog, workflow automations), Govern (guardrails, evals & datasets, deployments, audit log, schedules & triggers, providers & routing, readiness assessment, costs & budgets), Service Management, Service Health, Administration. Agent Operations, Build and Govern pages live under `app/(app)/agentops/<feature>/` (Model Catalog and Workflow Automations under `app/(app)/ai/`).

- `findNavItem(href)` and `findNavGroup(href)` resolve a page's title, icon and owning group; `PageHeader nav=` and the breadcrumbs use them, so a rename in `config/nav.ts` propagates everywhere.
- `NavItem.badge` is a `NavBadgeKey` (`approvals`, `reviews`, `recommendations`, `alerts`, `proposals`), never a literal. `getNavCounts()` in `config/nav-counts.ts` computes the numbers on the server from the same selectors the target pages use (`app/(app)/layout.tsx` passes them down). To add a badge, add a key to `NavBadgeKey` and a line to `getNavCounts()`.
- Chords are `shortcut: "G X"`. `config/nav.test.ts` fails when two items share a second key, so there is no silent shadowing. Current chords: Requests is `G Q`, Review Queue is `G R`.
- Sub-items (`items`) may reuse the parent href only for the "All ..." entry; `?view=` variants are separate entries.

## Stack rules

- Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui on **Base UI**, not Radix. Use the `render` prop to compose elements; there is no `asChild`.
- `cn` is imported from the `cn` package, not from a local utility.
- Icons are Lucide. Charts are Recharts 3 through the wrappers in `components/charts/`.
- Toasts are Sonner, mounted once in the root layout.

## Page anatomy

Every page follows the same skeleton so the eye lands in the same place on every route.

- **Header**: `<PageHeader nav="/agentops/traces" description=... actions=... />`. The `nav` prop resolves eyebrow (sidebar group), icon and title from `config/nav.ts`; pass `title` only to override it (for example `Traces · Support Triage` on a scoped list). Service Management, Workspace, Service Health and Administration pages use `PageHeader` too; nothing hand-rolls a title row.
- **KPI row**: `<StatGrid columns={N}>` with `StatCard` children. StatGrid owns the gap and the responsive breakpoints and injects `size="sm"`. AgentOps stat cards carry **no icons**; this is the one KPI dialect for the whole app. Deltas come from `lib/data/metrics.ts` (`compareWindows`, `countInWindows`, `sumInWindows`, `openCountDelta`, and the ready-made `openIncidentDelta`, `slaComplianceDelta`, `openAlertDelta`, `fulfilledRequestSpendDelta`, `approvalsRequestedDelta`, `meanTimeToResolveHours`), rendered through `StatDelta` or the `delta` / `deltaTone` props. Never type a literal delta or a fake KPI.
- **Inline metrics**: `MetricTile` (`label, value, unit?, hint?, tone?, delta?`) for KPIs inside cards, sheets and record sidebars. It replaces the local Kpi, SummaryCard, StreamStat and health-tile variants.
- **Labels and counts**: `Eyebrow` for small uppercase section labels (`as`, `mono`); `CountPill` for tab counts and section counts (`count, size, tone, label` for the screen-reader suffix). Do not hand-roll `text-[11px] uppercase tracking-...` spans or `rounded-full bg-muted px-1.5` counters.
- **Sheets**: `SheetContent className={cn(sheetWidths.detail | sheetWidths.editor, "flex flex-col gap-0 p-0")}`, then `SheetHeader className="border-b px-6 py-5"`, `SheetBody`, `SheetFooterActions({ primary, secondary, tertiary, cancelLabel, hideCancel })`. `detail` (`sm:max-w-xl`) is for read-only panels, `editor` (`sm:max-w-2xl`) for forms. Sheets are full width on phones by default; never pass `w-3/4` or `w-full`. `SheetFooterActions` renders Close by itself when no action is passed so every sheet is dismissable. All of this is in `components/shared/sheet-frame.tsx`.
- **Loading**: every list route has a `loading.tsx` rendering `<TableSkeleton />` and every `[id]` / `[number]` route has one rendering `<RecordSkeleton />` (`components/shared/skeletons.tsx`; `TableSkeleton` is also exported from `@/components/data-table` as `DataTableSkeleton`). `app/(app)/loading.tsx` renders the neutral `PageSkeleton` for everything else. Use `TableSkeleton` as the `Suspense` fallback around tables that read the URL.
- **Record pages**: `RecordHeader` (`editable` defaults to false; `EditableTitle` in `components/record/editable-title.tsx` when a title may be renamed), `RecordTabs` (reads and writes `?tab=` by default; pass `syncParam={null}` when the page already owns `?tab=`), `RecordLayout`, `ActivityStream`, `RelatedList`. `RecordOverflowItem` takes `onSelect`.

## Routing and deep links

- `params` and `searchParams` are Promises. `await` them in server components.
- Client components that call `useSearchParams` must be wrapped in `<Suspense>`.
- List pages use `<DataTable />` with facets and either `rowHref` to a record route or a `Sheet` driven by a query param. Pass `initialSearch` to seed the search box from a URL param.
- **Query params go through the shared hook.** `const [value, set] = useQueryParam("policy")` in `hooks/use-query-param.ts` reads through `useSearchParams` (so the caller sits inside `<Suspense>`) and writes with `history.replaceState` (`{ mode: "push" }` when the user should be able to go back), so a sheet opening or a tab change never triggers a server round trip or a scroll reset; `null` removes the key. `setQueryParams({ tab, policy })` merges several keys in one history update. Do not call `router.replace` for UI state; use it only when the server component needs the new value for data, and `router.push` only for real navigation.
- **Every link must target a param that is read.** If you emit `?foo=` somewhere, a page or component must consume it; otherwise fix the link or implement the reader. The contract below is the list of params that currently have readers.

| Param | Read by | Meaning |
| --- | --- | --- |
| `?tab=` | `RecordTabs` and every tabbed list page (costs, evals, tools, knowledge, guardrails, deployments, schedules, readiness, settings) | Active tab |
| `?tool=`, `?server=` | Tools & MCP | Open the tool or MCP server sheet |
| `?policy=`, `?byPolicy=` | Guardrails | Open a policy sheet; filter violations by policy |
| `?kb=`, `?mem=` | Knowledge & Memory | Open a knowledge base or memory store sheet |
| `?entity=` | Semantic Layer | Open an entity sheet |
| `?event=`, `?source=`, `?q=`, `?range=` | Audit Log | Open an event sheet; filter by source, free text and time range |
| `?q=`, `?category=` | Service Catalog | Seeded search and category |
| `?run=`, `?dataset=` | Evals & Datasets | Highlight a run; open a dataset sheet |
| `?open=` | Experiments, Recommendations | Expand one card |
| `?rec=` | Recommendations | Scroll to and highlight a recommendation |
| `?agent=` | Traces, Reviews, Drift, Experiments, Recommendations, Prompts, Playground, Tools, Knowledge, Evals, Deployments, Schedules, Costs | Scope the page to one agent |
| `?pv=`, `?prompt=` | Playground, prompt record | Load a prompt version |
| `?version=` | Prompt record, Traces | Select a prompt version; on Traces a `p-N` value selects the Prompt version facet, anything else the build Version facet |
| `?policy=` | Traces | Filter traces by the guardrail policy that fired |
| `?item=` | Review Queue | Open a review item |
| `?key=`, `?rule=` | Providers & Routing (keys, routing rules); Evals (gate rule) | Open the row's sheet |
| `?budget=` | Costs & Budgets | Open a budget sheet |
| `?schedule=`, `?trigger=` | Schedules & Triggers | Open a schedule or trigger sheet |
| `?alert=` | Alerts | Open the alert detail sheet |
| `?new=1` | Incidents, Changes, Problems, Knowledge | Open the create sheet (quick create and the command menu link here) |
| `?view=` | Incidents (`major`, `mine`, `open`), Changes (`cab`) | Saved views |
| `?status=`, `?outcome=`, `?flag=` | Traces | Preselected facets |
| `?state=` | Drift & Quality | `Open`, `Acknowledged`, `Resolved`, `active`, `all` |
| `?control=` | Readiness Assessment | Open a control sheet |
| `?section=` | Settings | Scroll to a section |
| `?period=` | Analytics | 7, 30 or 90 days |

- Breadcrumbs treat routed id prefixes as record segments; add new prefixes in `components/layout/breadcrumbs.tsx`. `recordHref()` in `components/shared/record-link.tsx` resolves `INC`, `PRB`, `CHG`, `REQ`, `KB`, `agt-`, `tr_`, `prm-`, `ev-`, `rel-`, `grd-`, `sem-`, `exp-` and `aud-`.

## Tables

- TanStack Table v9. Register features in `components/data-table/features.ts`; only the registered features are bundled.
- Build columns with `createColumnHelper<DataTableFeatures, T>()` and `col.columns([...])`.
- Custom sort is `sortFn`, not `sortingFn`. Built-in sort functions are registered explicitly in the features file; without that, columns relying on auto-detected alphanumeric or datetime sorting warn and do nothing.
- Table state is held by `<DataTable />` and passed down. There is no `table.getState()`.
- Search and faceted filtering are applied to the data before it reaches the table so filters stay URL-friendly and option counts are cheap.
- `DataTableColumnHeader` takes `hint` for jargon headers (p95, PSI, P(B > A)). `DataTable` takes `caption` (visually hidden) and `initialSearch`; the empty row renders `EmptyState`. The `dense` prop is deprecated: remove it from callers.

## Client state: stores

- `createStore(initial, storageKey?)` in `lib/store.ts` is the persisted store (`useSyncExternalStore` plus `localStorage`). Only the readiness store, the theme customizer and the assistant settings persist.
- `createListStore(seed, getId)` in `lib/store.ts` returns `{ use, get, subscribe, set, patch, add, remove, reset }` and is the pattern for every client-mutable list. Create it **once at module scope** (`features/agentops/stores.ts` for agents, reviews, drift, experiments, recommendations, semantic entities; `features/<module>/<module>-store.ts` or `features/agentops/<feature>/store.ts` elsewhere). Tables, stat cards, tab counts, sheets and sidebar-adjacent counts all read the same `store.use()`, so one action moves every number on the page. Nothing is persisted: a reload returns to the seed.
- **Stat cards render from the same store as the table.** A server-rendered stat card that goes stale when the client mutates must move into the client component and read `store.use()`.
- Stores expose `useHydrated()` where a component must know whether the client snapshot has replaced the server snapshot (for example to avoid flashing the seed count); use it instead of `useEffect` plus `useState`.
- Cross-page stores: `features/workspace/approvals-store.ts` is shared by the approvals inbox and the change record; `features/agentops/audit/audit-store.ts` is appended to by Guardrails, Evals and Deployments and keeps the hash chain verifiable (`sessionAuditIds` marks records added this session, shown as "This session").

## Truthful UI

- **Toasts describe something that happened in local state.** No toast may claim a download, export, audit entry, e-mail or webhook that did not occur. Either implement it (real `Blob` download, `navigator.clipboard.writeText`, a `createListStore` mutation, an `auditStore.append`) or reword the toast.
- **Destructive actions get an `AlertDialog`**: pause agent, roll back, disable guardrail, revoke or rotate key, deactivate user, delete snapshot, stop experiment, close alerts in bulk, kill switch and writes disabled.
- Shown-but-dead hints are bugs: if a button shows `Enter` or a `Kbd`, the handler must exist.
- Every link must point at a route or query param that is actually read (see the deep-link contract above).

## Keyboard contract

Global single-key handlers (`C` quick create, `D` dark mode, `G` chords) live in `components/layout/command-menu.tsx`. `shouldIgnoreShortcut(event)` makes them stand down when `event.defaultPrevented` is true, a modifier is held or the key is a repeat, the target is an input, textarea, select or contenteditable, or focus is inside a dialog, alert dialog, menu, listbox, combobox, sheet, the command palette or the assistant panel. Page-level handlers (review queue `A` / `C` / `S` / `F` / digits / `Enter` / `Esc`, playground, tables' `/`) **must call `event.preventDefault()`** on the keys they consume; they do not need to stop propagation. `Cmd/Ctrl K` and `Cmd/Ctrl ,` are handled before those checks because they are modifier chords.

## Base UI specifics

- **Checkbox**: use the `indeterminate` boolean prop, not `checked="indeterminate"`.
- **Menu labels**: `DropdownMenuLabel`, `ContextMenuLabel` and `SelectLabel` wrap Base UI `GroupLabel`, which throws unless rendered inside a `*Group` or `*RadioGroup`. Never place a label directly in `*Content`.
- **Select items**: `SelectValue` renders the raw value unless the `Select` root receives `items` (an array of `{ value, label }` or a record). Always pass `items` when values differ from labels.

## Data and time

- Everything is sample data under `lib/data/` with a fixed clock (`NOW` in `lib/data/seed.ts`) so server and client renders match.
- Read the time through `clock()` from `lib/data/seed.ts`. **Never call `new Date()` or `Date.now()` in render or in data modules.** `clock()` returns the frozen demo clock today and is the one place to switch to the wall clock when real data arrives.
- Use `createRng(<unique seed>)` for anything random in data modules. Never `Math.random()`.
- **Client components import specific modules** (`@/lib/data/agentops`, `@/lib/data/costs`), never the `@/lib/data` barrel; the barrel is for server pages. `lib/data/barrel.test.ts` and `test/data-barrel.test.ts` keep the barrel complete.
- Shared constants live where the data lives: `GATE_THRESHOLD` (85), `defaultExperimentSplit` (20), `fleetQualityBaseline` (89.5), `fleetTotals`, `telemetryHealth.sampleRate`, `traceFlags`, `availabilitySlo` (99.9), `keyRotationGraceHours` (24), `mcpPollIntervalSec` (30), `costByAgentWindowDays` (7), `STALE_AFTER_DAYS` (7) in their `lib/data/*.ts` modules; `cabSchedule` (`label` "Thursday 09:00 UTC"), `slaComplianceTarget`, `changeSuccessTarget`, `onHoldReminderDays`, `onHoldAutoResolveDays`, `approvalReminderHours` (18), `incidentAutoCloseDays` (3) in `lib/constants.ts`; `SIGNIFICANCE_THRESHOLD` (0.95) next to `defaultExperimentSplit` in `lib/data/agentops.ts`. Copy that quotes a threshold interpolates the constant.
- Count helpers (`pendingReviewCount`, `openRecommendationCount`, `openDriftCount`, `budgetsAtRiskCount`, `pendingReleaseApprovalCount`, `openAlertCount`, `unacknowledgedAlertCount`, `pendingApprovalCount`, `unreadNotificationCount`, `expiringKeyCount`, `incidentsForProblem`, `nextCab`) accept an explicit list so optimistic client state can be recounted; `lib/data/counts.test.ts` checks they match the page selectors.
- `getAgentOpsConfig(agentId)` lives in `lib/data/agent-config.ts` and returns ids (`guardrailIds`, `knowledgeBaseIds`, `budgets.budgetId`) next to display names, so the agent record links by id.

## Formatting values

Import formatters only from `@/lib/format`: `timeAgo`, `formatDate`, `formatDateTime`, `formatClock`, `formatUntil`, `formatCurrency`, `formatCost`, `formatNumber`, `formatTokens`, `formatPercent`, `formatDelta`, `formatMs`, `formatDurationMs`, `formatDuration`, `formatBytes`, `modelDisplayName`. The old `fmt*` names are aliases for the Agent Operations call sites; `features/agentops/format.ts` is a shim. Do not add per-feature duplicates.

## Feature layout and ids

- One data module per feature in `lib/data/<feature>.ts`, exporting its own types, using a deterministic `createRng` with a seed unique to the module, re-exported from `lib/data/index.ts`.
- UI in `features/agentops/<feature>/`, routes in `app/(app)/agentops/<feature>/`.
- Cross-link by id with the standard prefixes: agents `agt-`, traces `tr_`, experiments `exp-`, semantic entities `sem-`, prompts `prm-` (versions `p-N`), eval runs `ev-`, releases `rel-`, guardrails `grd-`, schedules `sch-`, triggers `trg-`, audit events `aud-`.

## Tokens and colour

- Status strings map to tones through `stateTone` in `components/shared/status-badge.tsx`; add new state strings there rather than colouring in pages. Unknown states fall back to neutral and a test checks that. `stateTone` also covers low-recall outcomes, `Valid`, change risks and the lower-case run states.
- Use `toneClasses` / `stateTone` / semantic tokens. **Never hard-code palette classes** (`text-red-500`, `bg-green-100`).
- Charts use `var(--chart-1)` to `var(--chart-8)`; do not cycle past 8. `CHART_HEIGHT = { sm: 180, md: 240, lg: 280 }` in `components/charts/chart-primitives.tsx`.
- `text-destructive-foreground` on `bg-destructive`, `text-success-foreground` on `bg-success`; never `text-white`. As text colour use `text-danger-text` / `text-info-text`, not `text-destructive` / `text-info`.
- `text-2xs` (0.6875rem) and `text-3xs` (0.625rem) replace `text-[11px]` and `text-[10px]`. The `eyebrow` and `eyebrow-mono` utilities back the `Eyebrow` component.
- `StatusDot` takes `label`.

## Charts

Use the components in `components/charts/` and `var(--chart-n)` colours. No dual axes. Show a legend whenever there are two or more series. Feature-specific charts that are reusable (`rollout-chart`, `coverage-radar`, `domain-heatmap`) live in `components/charts/`, not inside a feature folder.

## React and lint

- `react-hooks/set-state-in-effect` is on. Derive state during render or update it in event handlers, not in `useEffect`.
- Server components must not import functions from a `"use client"` module. Only components and props cross that boundary; calling a helper from one at render time fails at runtime with "Attempted to call X() from the server", and neither `tsc` nor ESLint catches it. Keep type guards and constants a page needs in a plain module next to the view, for example `features/agentops/guardrails/tabs.ts`, and import them from there in both the page and the client view.
- The full `jsx-a11y` recommended set is on. `anchor-has-content`, `heading-has-content` and `no-autofocus` are off globally because Base UI composes through `render`; `components/ui/**` relaxes three more rules. Do not add exceptions elsewhere.

## Model parameters

`ModelParams` and `ReasoningEffort` in `lib/types.ts` are the single shape for generation and agent-loop settings (temperature, top P, max output tokens, reasoning effort, tool choice, parallel tool calls, response format, stop sequences, seed, timeout, max tool calls, retries). Every `DeployedAgent` has `params`; prompt versions, the playground and releases reuse it. Edit it only through `ParamEditor` (`features/agentops/playground/param-editor.tsx`).

## Agent run semantics

`DeployedAgent.limits` (`RunLimits`), `paused`, `slo` and `errorBudget`, and `AgentTrace.outcome` (`TraceOutcome`), `lineage`, `streaming` and `boundHit` are required fields on the core types. `fleetControls` and `telemetryHealth` are exported from `lib/data/agentops.ts`. Outcome labels and badges live in `features/agentops/shared.tsx`. Guardrails carry `failMode`, `p95Ms` and `bypassRate`; tools carry `idempotent`, `supportsDryRun`, `outputSinks` and `identity`; MCP servers carry `definitionDigest`, `signatureVerified` and `vulnerabilities` (see `lib/data/tools.ts`).

## Readiness engine

- The engine is `lib/readiness/`, not `lib/data/`.
- `controls.ts` is the swappable configuration. The base 53 controls live there; the wave-2 controls live in `controls-visibility-quality.ts`, `controls-drift-safety.ts` and `controls-cost-governance.ts` and are merged and sorted by domain in `controls.ts`, for a total of 86. Their failure modes are merged in `library.ts`. New tools, metrics and framework items go in the shared catalogs first; the test suite rejects references to unknown ids.
- `scoring.ts` is the only place scores are computed. `codec.ts` is the only place state is serialised. `store.ts` is the persisted client store (`readinessStore`, `readinessActions`).
- UI components read through `useReadiness()` in `features/agentops/readiness/shared.tsx`; never evaluate or persist elsewhere.
- The sample assessment in `lib/data/readiness.ts` must stay deterministic and keep `lib/readiness/readiness.test.ts` green. Respondents are real users by full name (Kevin Dargas, Amara Okafor, Diego Ramírez); `lib/data/integrity.test.ts` checks that.
- Keep control ids stable (`VIS-01`...) because exports and share links reference them.
- Frameworks (`frameworks.ts`: OWASP, NIST, EU AI Act, OTel, ISO/IEC 42001) are data-driven. Adding one means a `FrameworkId`, a `FrameworkRefs` key and a `frameworkKey` entry.

## Audit log

`lib/data/audit.ts` derives an append-only, hash-chained `AuditEvent` list (`aud-000001` to `aud-000140`) from the existing version and activity arrays across eleven sources (prompt, guardrail, release, review, tool-permission, mcp-server, budget, memory, api-key, agent-config, readiness) plus seeded extras. `verifyAuditChain` must stay green in `features/agentops/audit/audit-data.test.ts`. Client mutations that deserve a record go through `auditStore.append` in `features/agentops/audit/audit-store.ts`, which continues the id sequence and chains the hash (`features/agentops/audit/audit-store.test.ts`). New mutations elsewhere should get an audit event rather than a separate history.

## AI layer

- `components/ai-elements/` is vendored shadcn AI Elements. Do not hand-edit beyond the small patches already applied: type fixes, and `message.tsx` loading only the Streamdown `code` plugin (CJK, math and Mermaid were dropped for bundle size). ESLint rules are relaxed for that folder.
- `AssistantPanel` is loaded with `next/dynamic` in `AppFrame` so the markdown stack stays out of first paint.
- App-level AI code lives in `components/ai/` and `lib/ai/`. The assistant is scripted (`planResponse`); keep new scenarios deterministic. `lib/ai/guardrails.ts` (`redactPii`, `toolCategoryFor`) is tested in `lib/ai/guardrails.test.ts`, which also checks that workflow proposals only name prompt versions belonging to the agent they talk about.
- Curated picker models live in `lib/ai/agents.ts` (`models`, with `openRouterId`); agentic templates in `lib/ai/templates.ts`, and every template prompt must hit a `planResponse` branch. `/ai/models` is the only page with live data: `lib/ai/openrouter.server.ts` fetches OpenRouter server-side with `next.revalidate` of one hour and must degrade to an empty state on failure. A model pinned from the catalog is stored in `AiSettings.catalogModel`.

## Theme customizer

Attributes `data-accent`, `data-radius`, `data-density` and `data-surface` go on `<html>`; their CSS lives in `app/globals.css`. The sidebar variant flows through `CustomizerProvider` to `AppFrame`. Persisted state must go through `lib/store.ts` or `useSyncExternalStore` to avoid hydration mismatches.

## Metadata and icons

`app/layout.tsx` exports `metadata` built from `siteConfig`: `metadataBase` from `siteConfig.url` (override with `NEXT_PUBLIC_SITE_URL`), a title template `%s · AgentOps`, `description`, `applicationName`, icons (`public/favicon.svg` plus `app/favicon.ico`), Open Graph and Twitter cards from `siteConfig.tagline`, and `robots: noindex`. Every `page.tsx` exports `metadata = { title }` matching its nav title so the tab reads `Traces · AgentOps`. Brand swap points are `siteConfig`, `public/favicon.svg` and `app/favicon.ico`.

## Copy

- No em or en dashes in copy, comments or docs; use a colon, a comma or a full stop. No emoji.
- Never mention AI assistants or how code or docs were produced. Model and vendor names inside product data are fine.
- The sample platform owner is Kevin Dargas (`u-001`, `kevin.dargas@agentops.dev`). The sample e-mail domain is `SAMPLE_EMAIL_DOMAIN` in `lib/data/users.ts`.
- Copy that quotes a number (threshold, CAB time, split) interpolates the constant that drives the behaviour.

## Formatting

Prettier at the repo's 80-column configuration with the Tailwind plugin is the source of truth. Run `pnpm format` on files you touch. Double quotes, no semicolons, trailing commas where ES5 allows.

## Tests

Vitest and Testing Library in jsdom (`pnpm test`). `next/navigation` is mocked in `test/setup.ts`. Scripted assistant changes must keep `lib/ai/assistant.test.ts` green: every starter prompt and template has to hit a real branch. Put tests next to the code as `*.test.ts` or `*.test.tsx`. See [testing](testing.md) for the full table.

## Error boundaries

`app/(app)/error.tsx` is the in-shell boundary, `app/global-error.tsx` the root one. Keep both self-contained; the root one renders its own `<html>` and `<body>` and must not import shell components.

## Before you finish

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Then load the routes you touched against `pnpm dev` and check the dev log for lines starting with the cross mark. Static checks do not cover the server and client component boundary. If a newly created file shows as "Module not found" in the dev server but `tsc` resolves it, stop the server and delete `.next`; Turbopack keeps a persistent file cache there.
