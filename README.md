# AgentOps

A modern, reusable UI template for operating an agentic AI ecosystem: deployed
agents treated like production services, with traces, human review, drift and
quality monitoring, experiments and model recommendations — plus the incident,
change and service-health workflows those agents plug into. Use it as the
starting point for any internal tool that needs a sidebar shell, rich data
tables, record pages with activity streams, dashboards and forms.

Built in the **shadcn/ui** style: every component lives in your codebase, is
themed through CSS variables, and can be edited freely.

## Stack

| Layer     | Choice                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| Framework | Next.js 16 (App Router, React 19, Turbopack)                                               |
| UI        | shadcn/ui on **Base UI** primitives (`base-nova` preset), Tailwind CSS v4                  |
| Tables    | TanStack Table v9 (feature registry, tree-shaken)                                          |
| Charts    | Recharts 3 via shadcn `ChartContainer`, validated accessible palette                       |
| AI UI     | shadcn **AI Elements** (conversation, message, prompt input, tool, reasoning, suggestions) |
| Icons     | Lucide                                                                                     |
| Theming   | CSS variables in OKLCH, `next-themes` light/dark/system                                    |
| Toasts    | Sonner                                                                                     |
| Tooling   | TypeScript, ESLint 9, Prettier + Tailwind plugin, pnpm                                     |

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm dev:warm   # dev server + pre-compiles the main routes in the background
pnpm warm       # pre-compile routes against an already running dev server
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint (Next rules + jsx-a11y recommended)
pnpm test       # vitest (jsdom) — unit tests for lib/ and key components
pnpm format     # prettier --write
pnpm build      # production build
```

Keyboard shortcuts: `⌘K` command menu · `⌘J` AgentOps Assist · `⌘B` toggle sidebar · `D` toggle dark mode · `G` then a letter to jump (P prompts, L playground, T tools, G guardrails, E evals, O fleet).

## What's included

**Agent Operations** — Fleet Overview (traffic, quality, spend, review volume, agents needing attention); Agents (deployed LangGraph / LangChain / custom agents with model, tools, owner, health, drift score and a rendered state graph); Traces (every run with spans, tokens, cost and evaluator scores, plus a span waterfall with inputs, outputs and attributes); Review Queue (human-in-the-loop workspace with a four-criterion rubric, approve / flag / correct / skip, keyboard driven); Drift & Quality (input, output, quality, tool and cost signals against each agent's baseline with explanations and actions); Experiments (A/B tests on models, prompts, retrieval and tooling with per-variant metrics, daily chart, significance and promotion); Recommendations (evidence-backed model changes from shadow evals, experiments and deprecation notices); Semantic Layer (governed metrics, dimensions, entities and glossary with formulas, sources, synonyms, lint issues and agent usage).
**Build** — Prompts (registry with immutable versions, production/staging labels, line-level diff between versions, variables panel, per-version model parameters and eval scores, usage by agent); Playground (full generation-parameter editor — temperature, top_p, max output tokens, reasoning effort, tool choice, parallel tool calls, response format with JSON schema, stop sequences, seed, timeout, tool-call and retry budgets — with deterministic simulated runs, A/B compare, diff vs deployed, save-as-version and apply-to-agent); Tools & MCP (tool registry with JSON-schema parameters, risk level, approval policy, call metrics; MCP servers with transport, auth, exposed tools and health; agents × risk permission matrix exported as JSON); Knowledge & Memory (vector indexes with chunking and retrieval settings, ingestion sources and jobs, per-agent memory stores with retention and PII policy, retrieval-quality charts and a test-retrieval panel); Semantic Layer; Model Catalog; Workflow Automations.
**Govern** — Guardrails (policy-as-code rules for input, output, action and data with block / flag / redact / approval modes, violations log linked to traces, agent × category coverage matrix, offline policy tester); Evals & Datasets (eval runs with per-evaluator scores and baseline deltas, regression-ordered case comparison grid, golden datasets, LLM-judge / rubric / schema / code evaluators with human-agreement calibration, release gates); Deployments (releases with canary / blue-green / shadow strategies, before-after config diff, rollout chart and controls, environments matrix, release approvals); Schedules & Triggers (cron schedules with a humaniser, event and webhook triggers, weekly calendar with freeze windows, run history); Providers & Routing (provider connections and health, scoped API keys with rotation, fallback / weighted / cost-based routing rules as Portkey-style JSON with a request simulator, rate limits); Costs & Budgets (spend by agent, model and provider, stacked budgets with alert thresholds and breach actions, forecast, CSV export, savings opportunities); Readiness Assessment (self-assessment of an AI system against 53 controls in six domains — visibility, quality, drift, safety, cost & performance, governance — see below).
**Workspace** — Overview dashboard (fleet health, spend, review queue, drift and failing evals first; incidents and changes second), My Work (reviews, experiments, assignments, approvals), Approvals, Analytics
**Service Management** — Incidents (list, detail, new-incident sheet with live priority matrix, resolve dialog), Problems (known errors, lifecycle), Changes (list, detail with approval + schedule conflicts, weekly calendar, CAB view), Requests (REQ → RITM → SCTASK), Service Catalog (browse + order dialog), Knowledge (list + article)
**Service Health** — Business service health and availability, Alerts (event management with bulk actions). The systems and services agents plug into live in `lib/data/cmdb.ts` as an internal data source; there is no inventory UI.
**Administration** — Users & groups, Settings (profile, appearance, notifications, platform)
**Assistant** — AgentOps Assist docked panel (context-aware chat with streamed reasoning, tool calls and one-click actions), a model picker grouped by vendor with per-model descriptions, a slide-in library of agentic templates (quality regression review, spend review, live prompt check, triage, root cause, change risk, CAB notes, knowledge drafts…), internal workflow agents (Prompt Hygiene, Cost Guardian, Eval Regression Sentinel, Tool Permission Auditor, incident triage, alert correlation…) with per-agent autonomy levels (suggest / act with approval / autonomous), approval queue, audit log, guardrails (model, action budget, allowed tools, PII redaction), and AI insights cards on records. The assistant is a scripted engine in `lib/ai/assistant.ts` so the UI runs without an API key; swap it for a real agent backend.
**Model Catalog** — `/ai/models` is the one page backed by live data: it fetches the public [OpenRouter models endpoint](https://openrouter.ai/api/v1/models) server-side (cached for an hour), normalizes 400+ models into a faceted table (provider, capability, input modality, price band, context size) with a detail sheet, and lets you pin any model into the assistant's picker.
**Theme customizer** — top-right paintbrush: light/dark/auto, five one-click styles (Nova, Console, Aurora, Forest, Ember), seven accent colors, radius scale, density, surface treatment and sidebar variant. Persisted per browser and applied before first paint.

Cross-cutting: collapsible icon sidebar, breadcrumbs, global command menu with
record search, quick-create, notifications, theme toggle, skeleton loading,
not-found states, route and global error boundaries, and deterministic mock
data for every module.

## Project structure

```
app/
  layout.tsx            Root: fonts, ThemeProvider, TooltipProvider, Toaster
  (app)/layout.tsx      App shell (sidebar + header) for every module
  (app)/<module>/...    Route segments per module (agentops, ai, itsm, itom, admin)
components/
  ui/                   shadcn/ui primitives (generated, editable)
  ai-elements/          shadcn AI Elements (vendored registry code)
  ai/                   AiProvider, AssistantPanel (lazy-loaded), ModelPicker, TemplateMenu, agent/proposal cards, RecordAiInsights
  theme/                CustomizerProvider + ThemeCustomizer popover
  layout/               app-sidebar, site-header, command-menu, notifications…
  data-table/           Generic TanStack v9 <DataTable /> + toolbar pieces
  record/               RecordHeader, RecordTabs, ActivityStream, RelatedList
  shared/               StateBadge/PriorityBadge, StatCard, DetailList, UserChip…
  charts/               Trend, bar, stacked bar, donut, sparkline
features/<module>/      Module-specific columns, tables, forms, actions
features/agentops/      Fleet overview, agents & traces tables, trace waterfall, agent graph,
                        review queue, drift board, experiments, recommendations, semantic layer;
                        one folder per control surface: prompts, playground, agent-config, tools,
                        knowledge, guardrails, evals, deployments, schedules, providers, costs
features/agentops/readiness  Readiness Assessment: setup form, controls list + control sheet, results
                        (radar, heatmap, maturity ladder, release gate, gap table), framework mappings,
                        tooling (tool matrix, snippets, metric catalog), library, share/import/compare
features/ai/model-catalog  OpenRouter catalog table, facets and detail sheet
config/                 nav.ts (sidebar + command menu), site.ts
lib/
  ai/                   agents.ts (agents, proposals, curated models) · assistant.ts (scripted engine)
                        templates.ts (agentic templates) · openrouter.ts (live catalog fetch + normalize)
  readiness/            Readiness Assessment engine: types, the swappable control set (controls.ts),
                        framework/tool/metric/snippet/failure-mode catalogs, scoring, codec
                        (JSON / CSV / Markdown / URL state), localStorage store
  theme-presets.ts      Accent/radius/density/sidebar presets + init script
  store.ts              Tiny persisted external store (useSyncExternalStore)
  types.ts              Domain model (DeployedAgent, AgentTrace, Incident, Change…)
  constants.ts          State lists, priority matrix, SLA targets
  data/                 Deterministic mock data (seeded PRNG, fixed clock); agentops.ts holds
                        agents, traces, reviews, drift, experiments, recommendations, semantic layer;
                        one module per control surface (prompts, playground, tools, knowledge,
                        guardrails, evals, deployments, schedules, providers, costs) exporting its
                        own types; cmdb.ts is the internal list of systems/services agents plug into
  format.ts             Dates, currency, relative time
```

## Readiness Assessment

`/agentops/readiness` is a self-contained, client-side control assessment for an AI system.

- **Control set** — `lib/readiness/controls.ts` defines six domains and 53 controls. Each control carries *what / why / how / done-looks-like*, a risk weight (1–5), effort, the earliest maturity stage at which it is required (`prototype` → `pilot` → `production`), an optional release-gate flag, an applicability rule (system type, autonomy, data sensitivity, exposure, regulatory scope), framework tags (OWASP LLM Top 10, NIST AI RMF, EU AI Act articles, OTel GenAI attributes), suggested tools, metrics, snippets and a review cadence. Fork this file (or import a JSON control set from the Share tab) to adapt it to another domain; keep ids stable so saved assessments still match.
- **Setup** — the system profile drives the applicability filter (controls that do not apply are hidden or down-weighted) and the maturity target shifts which controls are required.
- **Scoring** (`lib/readiness/scoring.ts`) — status credit none 0 · planned 0.15 · partial 0.5 · in place 0.85 · verified 1, weighted by risk × applicability × stage. Overall and per-domain coverage, maturity level (ad hoc / defined / managed / optimized), prioritized gaps (severity then effort), release-gate blockers and review due dates are all derived from the same function.
- **Sharing** (`lib/readiness/codec.ts`) — export JSON, Markdown, CSV or print to PDF; the share link URL-encodes the whole assessment in the fragment (`#s=…`); import re-loads a saved file or link; snapshots give history and a run-to-run diff; team mode collects one vote per respondent and surfaces disagreement.
- **Privacy** — state lives in `localStorage` under `agentops.readiness.v1`. Nothing is sent to a server, which makes a public deployment safe. The module is fully client-rendered; it deploys on Vercel or Netlify as-is, and on GitHub Pages once the app is built with `output: "export"`.

## Adding a module

1. **Model** — add types to `lib/types.ts`, states to `lib/constants.ts`, mock data under `lib/data/`.
2. **List page** — create `features/<module>/<name>-table.tsx` with `createColumnHelper<DataTableFeatures, T>()` and render `<DataTable />` with `facets`, `getSearchText`, `rowHref`.
3. **Record page** — `app/(app)/<module>/[number]/page.tsx` composing `RecordHeader`, `DetailList`, `RecordTabs`, `ActivityStream`, `RelatedList`.
4. **Navigation** — add the entry to `config/nav.ts`; the sidebar, breadcrumbs and command menu pick it up automatically.
5. **Status vocabulary** — add any new state strings to `stateTone` in `components/shared/status-badge.tsx`.

## Theming

Tokens live in `app/globals.css`. Beyond the shadcn defaults the template adds
`--brand`, `--success`, `--warning`, `--info` (with foregrounds) and sets
`--chart-1…5` to a colorblind-safe categorical palette validated for both light
and dark surfaces. Swap values in `:root` / `.dark` to rebrand; nothing else
needs to change.

## Testing

Unit tests run with [Vitest](https://vitest.dev) in jsdom (`pnpm test`). The
suite covers the formatting helpers, the OpenRouter normalizer, every scripted
assistant branch (each starter prompt and agentic template must produce a real
answer rather than the generic fallback) and the `DataTable` search and facet
behaviour. `test/setup.ts` stubs `next/navigation` and the browser APIs Base UI
and Recharts need; add new tests next to the code as `*.test.ts(x)`.

## Wiring agent telemetry

`lib/data/agentops.ts` is shaped like what an OpenTelemetry / LangSmith-style
exporter produces: `DeployedAgent` (graph, model, tools, metrics), `AgentTrace`
with `TraceSpan[]` (node type, timing, tokens, cost, inputs/outputs,
attributes), `ReviewItem`, `DriftSignal`, `Experiment`, `ModelRecommendation`
and `SemanticEntity`. Replace the module with API clients that return the same
types and every Agent Operations page keeps working. The review queue,
experiments, recommendations and semantic layer hold their edits in local state
with toasts; swap those handlers for mutations.

## Wiring a real AI backend

`lib/ai/assistant.ts` returns an `AssistantRun` (reasoning, tool calls, markdown, actions, follow-ups) for a prompt and page context. Replace `planResponse` with a call to your agent API that streams the same step shapes, and the panel, insights cards and approval queue keep working. Agent definitions, proposals and the audit log in `lib/ai/agents.ts` map directly onto an agents service.

## Wiring real data

All pages read from `lib/data`. Replace those modules with your API clients
(server components can `await` directly; tables accept any `data` array) and
keep the component layer unchanged.

## License

MIT
