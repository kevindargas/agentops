# Assistant and shell

This page covers the surfaces that wrap every module: the AgentOps Assist panel, the command menu and keyboard chords, quick create, the sidebar, breadcrumbs, notifications, the theme customizer, and the loading, not-found and error screens. All of them are client components mounted once in `components/layout/app-frame.tsx` (inside `app/(app)/layout.tsx`) and `app/layout.tsx`.

Nothing in the shell talks to a server. The assistant is scripted, notifications are seeded, and the theme and panel state persist only in the browser.

## AgentOps Assist

AgentOps Assist is the in-app assistant. It reads the current page, answers questions about the record or the workspace with a visible plan (reasoning, tool calls, sources), proposes actions that can be applied or queued for approval, and hosts the workflow agents and their approval queue. In this template the engine is a deterministic script, which the panel labels "Scripted demo".

**Opening it.** `⌘J` (or `Ctrl+J`) toggles the panel from anywhere. The sparkle button in the header does the same; it pulses while a response is streaming and shows a dot while proposals are waiting. The command menu has "Toggle AgentOps Assist". The Overview "Review in Assist" button opens it on the Queue tab. On screens 1024px and wider it is a docked 400px right-hand panel; below that it is a slide-over sheet. Open state and active tab persist in `localStorage` under `agentops:assistant`.

**Header.** Name and "Scripted demo" badge; a context line reading "Working on <record>" when a record is in context or "Workspace assistant" otherwise, plus the active model name; "Clear conversation" (when messages exist), a link to Workflow Automations (`/ai`), and Close.

**Tabs.**

| Tab    | Content                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat   | conversation with the assistant                                                                                                                |
| Agents | the nine workflow agents from `lib/ai/agents.ts` with an enable switch and an autonomy select each, and a "Workflow Automations" link to `/ai` |
| Queue  | proposals waiting for a decision, each with Approve and Reject; a count pill shows the count                                                   |

**Record context.** `contextFromPathname` in `lib/ai/assistant.ts` recognizes `/itsm/incidents/INC...`, `/itsm/changes/CHG...`, `/itsm/problems/PRB...`, `/itsm/requests/REQ...`, `/itsm/knowledge/KB...`, `/agentops/agents/agt-...` and `/agentops/traces/tr_...`. On those pages the empty chat shows "Working on <number>", a record card, and record-specific starter prompts; everywhere else it shows workspace prompts.

**Starter prompts.**

| Context       | Prompts                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incident      | Summarize this incident; Draft a customer update; Find similar incidents; What's the likely root cause?                                                                                                                                     |
| Change        | Assess the risk of this change; What services are impacted?; Draft CAB notes; Check for schedule conflicts                                                                                                                                  |
| Problem       | Summarize the investigation so far; Suggest a root cause hypothesis; Draft a known error article                                                                                                                                            |
| Request       | Where is this request stuck?; Summarize the items and approvals; Draft an update for the requester                                                                                                                                          |
| Article       | Is this article still accurate?; Summarize this article; Which incidents could this article resolve?                                                                                                                                        |
| Agent         | How is this agent doing?; Why is quality drifting?; Should we change the model?                                                                                                                                                             |
| Trace         | Explain this trace; Why was this answer flagged?; Where did the time go?                                                                                                                                                                    |
| Anywhere else | What needs my attention today?; Which agents are over budget?; Why did Support Triage's quality drop this week?; Show me the latest prompt version for the helpdesk agent; Which changes are scheduled this week?; Summarize service health |

**How a response is built.** When "Redact personal data" is on, `redactPii` in `lib/ai/assistant.ts` first masks e-mail addresses, phone numbers and IBANs in the prompt (`[email]`, `[phone]`, `[iban]`) and a toast says how many values were replaced; the redacted text is what the user message shows and what the engine sees. `planResponse(prompt, context)` then returns an `AssistantRun` of steps; `AiProvider` replays them with delays so they appear to stream. Each tool step is mapped to an allowed-tools category with `toolCategoryFor` (`lib/ai/agents.ts`); a step whose category is unchecked under Allowed tools on Workflow Automations renders as "(skipped)" with the reason in its output instead of running. Branches are chosen by record type and keywords in the prompt: incident (summarize, similar, root cause), change (risk, impact, CAB, conflicts), problem (known error article), request, article, agent (model change, drift), trace (time, flagged), then workspace-level topics (quality regression, budget and spend, prompt version, "attention today", changes this week, service health). Anything else falls back to a keyword search over incidents and returns a table or a short help message. Every starter prompt and template is covered by a branch and by `lib/ai/assistant.test.ts`.

**Message parts.**

| Part              | Rendering                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reasoning         | collapsible "thinking" block; hidden entirely when Show reasoning is off in AI settings                                                                                              |
| Tool call         | collapsible card with the tool name, input and output JSON (names like `read_incident`, `search_knowledge`); skipped calls carry "(skipped)" in the title and a reason in the output |
| Text              | markdown with tables and blockquotes                                                                                                                                                 |
| Sources           | chips linking to the records the answer used (incident, change, problem, article, alert, request, agent, trace, drift, experiment)                                                   |
| Suggested actions | list with risk (low, medium, high) and "needs approval"; button is "Apply" or "Request"                                                                                              |
| Suggestions       | follow-up prompt chips, shown only on the latest message                                                                                                                             |

The latest message has a toolbar: Copy, Regenerate (re-runs the last user prompt), Good response and Needs work (toasts that say the feedback stays in this session).

**Applying actions.** "Apply" on a low-risk action records an entry in the Workflow Automations activity list and marks the action "Applied"; the toast says the sample record itself does not change. "Request", any high-risk action while "Require approval for high risk" is on, or any action once the enabled agents' `actions24h` have reached the daily action budget, creates a proposal in the Queue tab attributed to the Incident Triage agent and marks the action "Queued" (the budget case says so in the toast and the proposal rationale). All of this is local state.

**Composer.** Enter sends, Shift+Enter inserts a newline, Escape anywhere in the chat tab stops a streaming response (the footer hint "Esc to stop" is true for the whole panel). Toolbar: Agentic templates toggle, model picker (compact), Attach context (disabled, toast), and the record number badge when in context. The footer line reads "Scripted demo: responses are deterministic and nothing leaves your browser" before the first message and "Actions that need approval are queued, never applied silently" after. Message timestamps are anchored to the fixed demo clock (`NOW`), never the wall clock.

**Agentic templates.** A slide-in menu inside the chat tab (Escape closes it) with a search box. Templates that fit the current record appear first under "For this incident" (or change, problem, and so on); the rest are grouped by category. Each card shows the step plan, a "Writes" badge when the template may propose changes, and the recommended model; the tooltip shows the plan and the exact prompt. Running a template sends its prompt with `{record}` replaced by the record number.

| Category   | Templates (applies to; writes; best with)                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent Ops  | Agent health review (agent; no; Claude Haiku 5.5), Drift triage (agent; yes; Claude Fable 5.1), Model change review (agent; yes; Claude Sonnet 5.5), Explain this trace (trace; no; Claude Sonnet 5.5), Quality regression review (anywhere; yes; Claude Sonnet 5.5), Spend review (anywhere; yes; Claude Haiku 5.5), Live prompt check (anywhere; no; Claude Haiku 5.5) |
| Incidents  | Incident briefing (yes; Claude Sonnet 5.5), Root cause analysis (no; Claude Fable 5.1), Find similar incidents (yes; Claude Haiku 5.5), Stakeholder update (yes; Claude Sonnet 5.5)                                                                                                                                                                                      |
| Changes    | Change risk review (yes; Claude Fable 5.1), Impact analysis (no; Gemini 3.1 Pro), CAB notes (yes; Claude Sonnet 5.5)                                                                                                                                                                                                                                                     |
| Problems   | Problem investigation (no; Claude Fable 5.1)                                                                                                                                                                                                                                                                                                                             |
| Knowledge  | Known error article (incident or problem; yes; Claude Sonnet 5.5)                                                                                                                                                                                                                                                                                                        |
| Operations | Daily attention list (no; Claude Haiku 5.5), Change calendar review (no; GPT-5.4 mini), Service health digest (no; Gemini 3 Flash)                                                                                                                                                                                                                                       |

Templates live in `lib/ai/templates.ts`; the recommended model is advisory and does not change the picker.

**Model picker.** Groups the curated models in `lib/ai/agents.ts` by vendor with a tier badge (Reasoning, Balanced, Fast), a one-line description and the context window:

| Vendor    | Models                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Anthropic | Claude Fable 5.1 (Reasoning, 1M), Claude Sonnet 5.5 (Balanced, 1M, default), Claude Haiku 5.5 (Fast, 200K) |
| OpenAI    | GPT-5.5 (Reasoning, 400K), GPT-5.4 mini (Fast, 400K)                                                       |
| Google    | Gemini 3.1 Pro (Reasoning, 1M), Gemini 3 Flash (Fast, 1M)                                                  |
| DeepSeek  | DeepSeek V3.2 (Balanced, 164K)                                                                             |
| xAI       | Grok 4.7 (Balanced, 2M)                                                                                    |

Each curated model carries an `openRouterId` for deep links into the Model Catalog (`/ai/models`). A model pinned from the catalog appears at the top under "From model catalog" with an Unpin item. The selection is stored in `AiSettings.modelId` (`localStorage` key `agentops:ai-settings`), which also holds default autonomy (stored only, labelled Planned), require-approval-for-high-risk, PII redaction, daily action budget and allowed tools (all three enforced by the assistant as described above) and show-reasoning. The model only labels the run; the script does not change with it.

**Agents tab.** Nine workflow agents: Incident Triage, Alert Correlation, Change Risk Assessor, Knowledge Curator, Prompt Hygiene, Cost Guardian, Eval Regression Sentinel, Tool Permission Auditor and Major Incident Comms (paused in the seed). Each card shows health, description, an autonomy select (Suggest, Act with approval, Autonomous), 24-hour actions and acceptance rate, and an enable switch. Disabling sets health to Paused. Changes are local state.

**Queue tab.** Six seeded proposals (for example "Create incident from 3 correlated alerts on sw-core-east-01", "Raise risk from Moderate to High and require CAB review" on `CHG0031104`, "Re-run the helpdesk golden set on p-27 for IT Helpdesk Copilot") plus anything queued from chat. Cards show the proposing agent, impact badge, rationale, an optional field diff, a confidence meter and a link to the record. Approve or Reject removes the proposal and appends to the activity list with a toast. The same proposals feed the Overview "Agent proposals" card and Workflow Automations.

**Record insights card.** Rendered on incident records (`components/ai/record-ai-insights.tsx`, used in `app/(app)/itsm/incidents/[number]/page.tsx`) with the title "Insights" and a "Scripted" badge. It shows the Incident Triage agent's status and autonomy, chips passed by the page (Suggested priority, Similar incidents, Correlated alerts, Knowledge matches), a Summarize button that streams the "summarize" branch of `planResponse` locally (the markdown renderer loads on first use with `next/dynamic`), a Similar records list and a Suggested next action with confidence and signals from `recordInsights`, and prompt chips that open the assistant with that question. If the triage agent is disabled in the Agents tab the card warns that insights may be stale.

**Replacing the engine.** Swap `planResponse` in `lib/ai/assistant.ts` for a client that streams the same step shapes; the panel, insights card and queue keep working. Keep `redactPii` in front of it or move redaction server-side. Agents, proposals, activity, curated models and `toolCategoryFor` are in `lib/ai/agents.ts`. `lib/ai/assistant.test.ts` keeps every starter prompt and template on a real branch; `lib/ai/guardrails.test.ts` covers redaction, the tool-category map and the proposal copy.

## Command menu

`⌘K` (or `Ctrl+K`) opens a command dialog; the header search box, the sidebar Search entry, the user menu and the not-found pages open the same dialog. Escape closes it; arrow keys move; Enter opens.

**Records.** From two characters on, the query is matched case-insensitively against incidents (number, short description), problems (number, short description), changes (number, description), requests (number and catalog item names), articles (number, title), agents (id, name, team, framework, model id), semantic entities (name, kind, domain, synonyms), prompts (id, slug, name, type) and releases (id, version, summary, agent id). Traces are searched only when the query starts with `tr_`. The first twelve hits are shown with a record number, title and a state or priority badge.

**Actions.** New incident (`/itsm/incidents?new=1`), New change request (`/itsm/changes?new=1`), New service request (`/itsm/catalog`), New problem (`/itsm/problems?new=1`), New knowledge article (`/itsm/knowledge?new=1`), Toggle sidebar, Toggle AgentOps Assist. Incidents, Changes, Problems and Knowledge each open their create sheet from `?new=1`; the service request item goes to the catalog, which has no sheet.

**Navigation.** One group per sidebar section (Workspace, Agent Operations, Build, Govern, Service Management, Service Health, Administration) listing every page with its description, keywords and chord. Appearance has Light, Dark and System theme.

**Chords.** Press `G`, then within 1.2 seconds a letter. Chords are ignored while typing in an input, textarea or select, inside an open dialog, sheet, menu or listbox, inside the assistant panel, when a modifier key is held, and when a page-level handler has already called `event.preventDefault()` on the key. The map comes from `shortcut` fields in `config/nav.ts`:

| Chord | Page                         |
| ----- | ---------------------------- |
| G D   | Overview                     |
| G W   | My Work                      |
| G A   | Approvals                    |
| G N   | Analytics                    |
| G O   | Fleet Overview               |
| G R   | Review Queue                 |
| G Q   | Requests                     |
| G P   | Prompts                      |
| G L   | Playground                   |
| G T   | Tools & MCP                  |
| G X   | Workflow Automations (`/ai`) |
| G G   | Guardrails                   |
| G E   | Evals & Datasets             |
| G Y   | Readiness Assessment         |
| G I   | Incidents                    |
| G C   | Changes                      |
| G K   | Knowledge                    |
| G H   | Service Health               |
| G S   | Settings                     |

Other single keys: `C` opens quick create, `D` toggles light and dark, `⌘,` opens Settings (all in `components/layout/command-menu.tsx`). `⌘B` toggles the sidebar and `⌘J` the assistant. Page-level shortcut handlers (for example the review queue) claim a key by calling `event.preventDefault()`; the global handler then leaves it alone.

## Quick create

The "New" button in the header (shortcut `C`) opens a menu with Incident, Change request, Service request, Problem and Knowledge article, using the same `quickCreateItems` and targets as the command menu Actions group. Incident, Change request, Problem and Knowledge article open their create sheets through `?new=1`; Service request goes to the catalog.

## Sidebar

The sidebar lists seven groups from `config/nav.ts`. `⌘B` (or the header toggle) collapses it to icon mode; the state is kept in a `sidebar_state` cookie that the server reads so the first paint has the right width. In icon mode, hovering shows a tooltip with the page name and chord, and group separators replace the labels.

Entries with children (Incidents, Changes) expand when their section is active and can be toggled manually; the child whose exact URL matches (including `?view=major` or `?view=cab`) is highlighted, otherwise the plain-path child is. The thin accent bar slides between active entries.

Badges next to Approvals, Review Queue, Recommendations, Workflow Automations and Alerts are live counts: each `NavItem.badge` is a `NavBadgeKey` that `getNavCounts()` in `config/nav-counts.ts` resolves on the server from the same selectors the target pages use (6 approvals, 36 pending reviews, 4 new recommendations, 6 proposals, 17 open alerts in the sample).

The footer shows the current user with a static green presence dot. Its menu has Profile (`/settings`), My approvals (`/approvals`), Notifications (`/settings?tab=notifications`), Settings (`⌘,` is handled in the command menu and routes to `/settings`), Command menu, Log out (shows a "Signed out" demo toast) and the version line "AgentOps v0.1.0 · Acme Corp" from `config/site.ts`.

## Breadcrumbs

The header breadcrumbs start with a home icon (`/dashboard`) and one crumb per path segment. Labels come from the nav title when a page exists for that path, from `segmentLabels` for section prefixes (`itsm` Service Management, `itom` Service Health, `admin` Administration, `agentops` Agent Operations), verbatim in monospace for record ids (`INC0010078`, `tr_...`, `agt-...`, `prm-...`, `ev-...`, `rel-...`, `exp-...`, `sem-...`, `aud-...`), and otherwise from the segment with hyphens turned into spaces and title case. Intermediate segments without a page (for example `itsm`) render as plain text. On small screens only the last crumb is shown.

## Notifications

The bell in the header shows a red dot while unread notifications exist. The popover has All and Unread filters, "Mark all as read", a scrollable list and two footer links: Notification settings (`/settings?tab=notifications`) and View all (`/my-work`). Each item has an icon by type (assignment, approval, sla, mention, system), title, body and relative time; clicking it marks it read and navigates to its record.

The six notifications are static in `lib/data/activity.ts` (a P1 major incident, an approval request, an assignment, an SLA warning, a mention and a drift signal). Read state is component state and resets on reload.

## Theme customizer

The paintbrush button in the header opens the Appearance popover (`components/theme/theme-customizer.tsx`). The header line names the active style preset (or "Custom style") and the accent; Reset returns everything to defaults and is disabled when already default. A live preview strip shows a primary button, an outline button, a badge and an input with the current tokens.

| Group   | Options                                               | Applied as                                                   |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Mode    | Light, Dark, Auto (hint: press `D`)                   | `next-themes` class on `<html>`, with a short cross-fade     |
| Style   | Nova (default), Console, Aurora, Forest, Ember, Slate | one-click combination of the five settings below             |
| Accent  | Neutral, Ocean, Violet, Emerald, Rose, Amber, Teal    | `data-accent`                                                |
| Radius  | Sharp, Subtle, Default, Soft, Round                   | `data-radius`                                                |
| Density | Comfortable, Compact                                  | `data-density`                                               |
| Surface | Flat, Elevated                                        | `data-surface`                                               |
| Sidebar | Inset, Classic, Floating                              | sidebar `variant` through `CustomizerProvider` to `AppFrame` |

Presets: Nova is neutral, default radius, comfortable, inset, flat. Console is ocean, subtle radius, compact, classic sidebar, flat. Aurora is violet, soft radius, floating sidebar, elevated. Forest is emerald, default radius, classic sidebar, elevated. Ember is amber, round radius, inset, elevated. Slate is teal, subtle radius, compact, inset, elevated.

Settings are stored in `localStorage` under `agentops:theme` by the module-level store in `components/theme/customizer-provider.tsx` (read with `useSyncExternalStore`, synced across tabs through the `storage` event). An inline script from `lib/theme-presets.ts` (`themeInitScript`, injected in `app/layout.tsx`) applies the stored attributes before first paint and validates values against the known ids. The footer reads "Saved to this browser only. Mode follows your OS when set to Auto." The assistant's own stores (`agentops:assistant`, `agentops:ai-settings`) use `createStore` from `lib/store.ts`; the theme does not.

## Loading, not found and error screens

| Screen            | File                                              | When                                                                                                                                                        |
| ----------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route skeleton    | `app/(app)/loading.tsx`                           | while a page inside the shell loads and the route has no `loading.tsx` of its own; renders `PageSkeleton` (header plus two cards). List routes ship `TableSkeleton` and record routes `RecordSkeleton` in their own `loading.tsx` (`components/shared/skeletons.tsx`)                                                                    |
| Table skeleton    | `DataTable loading` prop and `Suspense` fallbacks | list pages render a tall skeleton while client tables mount                                                                                                 |
| Page not found    | `app/(app)/not-found.tsx`                         | unknown route inside the shell; "Back to overview", a command menu trigger and the first four Workspace pages as suggestions                                |
| Record not found  | `components/record/record-not-found.tsx`          | a record route whose number does not exist; shows the number, "Back to <list>", "Go to my work" and a `⌘K` hint                                             |
| Root not found    | `app/not-found.tsx`                               | unknown route outside the shell                                                                                                                             |
| Page error        | `app/(app)/error.tsx`                             | a page threw; sidebar and header stay usable; "Try again" calls `reset`, "Back to overview" links home; the digest is shown, and the message in development |
| Application error | `app/global-error.tsx`                            | the root layout threw; self-contained HTML with "Try again" and a link to `/dashboard`                                                                      |

Both error boundaries log to the console; replace that call with your error reporter.

## Where the shell gets its data

| Surface                                                                                   | Source                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation, chords, badges, quick create                                                  | `config/nav.ts`; shortcut display strings in `config/site.ts`                                                                                       |
| Command menu record search                                                                | `incidents`, `changes`, `requests`, `knowledgeArticles`, `deployedAgents`, `semanticEntities`, `prompts`, `releases`, `agentTraces` from `lib/data` |
| Notifications                                                                             | `notifications` in `lib/data/activity.ts`                                                                                                           |
| Current user                                                                              | `currentUser` in `lib/data/users.ts`                                                                                                                |
| Assistant script, starter prompts, record insights                                        | `lib/ai/assistant.ts`                                                                                                                               |
| Workflow agents, proposals, activity, runs, curated models, tool catalog, autonomy labels | `lib/ai/agents.ts`                                                                                                                                  |
| Agentic templates                                                                         | `lib/ai/templates.ts`                                                                                                                               |
| Theme presets and init script                                                             | `lib/theme-presets.ts`                                                                                                                              |
| Persisted client stores                                                                   | `lib/store.ts` (`createStore`, `useMediaQuery`)                                                                                                     |

All records are the same deterministic mock data as the pages, anchored to `NOW` in `lib/data/seed.ts`.
