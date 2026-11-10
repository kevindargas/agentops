# Workflow Automations

Workflow Automations manages the internal workflow agents that work alongside the operations teams: Incident Triage, Alert Correlation, Change Risk Assessor, Knowledge Curator, Prompt Hygiene, Cost Guardian, Eval Regression Sentinel, Tool Permission Auditor and Major Incident Comms. For each one you set the autonomy level (suggest, act with approval, autonomous), pause or resume it, approve or reject what it proposes, read its run history and activity, and set the guardrails shared with the AgentOps Assist panel: model, default autonomy, daily action budget, high-risk approval, PII redaction and the allowed tool set.

These agents are distinct from the deployed customer and employee-facing agents on the Agents page (`agt-…`). They operate the platform itself: they triage incidents, correlate alerts, score change risk, draft knowledge articles, lint prompts, watch spend and evals, and audit tool grants.

## Where to find it

- Sidebar: Build, Workflow Automations. The nav badge is the `proposals` key resolved by `config/nav-counts.ts`. Keyboard chord `G` then `X`.
- Route: `/ai`. Tabs are component state, not URL parameters.
- The dashboard's "Agent proposals" card (`features/ai/agent-proposals-card.tsx`) previews the first three proposals with Approve and Reject and links here with "Workflow Automations" and "View all". The assistant panel (`⌘J`) has an "agents" tab and a "queue" tab that show the same agents and proposals, and its header links here.
- Code: route `app/(app)/ai/page.tsx`; UI `features/ai/control-center.tsx`; cards `components/ai/agent-card.tsx` and `components/ai/proposal-card.tsx`; state and settings `components/ai/ai-provider.tsx`; data `lib/ai/agents.ts`.

## What is on the page

Header: eyebrow "Build", title "Workflow Automations" (from `config/nav.ts`; the page, the sidebar and the breadcrumb agree). Actions: "Model catalog" (link to `/ai/models`), "Pause all agents" or "Resume all agents" (reads "Pause" when any agent is enabled), "Open Assist".

Stat cards (`StatGrid`, four columns):

| Card                   | Value                                                                                               | Notes                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent actions 24h      | Sum of `actions24h` over enabled agents, with a 7-day sparkline of autonomous plus approved actions | Hint "N of M agents active · K degraded". Delta is derived: autonomous plus approved actions today versus yesterday from `usageByDay`, labelled "vs yesterday" |
| Awaiting your approval | Number of open proposals                                                                            | Hint shows the age of the oldest proposal, or "Queue is clear"                                                                                                 |
| Acceptance rate        | Mean `acceptanceRate` across all agents, enabled or not                                             | Hint "Proposals approved or left unchanged, all agents". No delta: the data has no history for it                                                              |
| Time saved 24h         | Sum of `actions24h × avgSavedMinutes` over enabled agents, in hours                                 | Hint "N tokens · K% of daily budget"; tokens are the sum of `tokens24h` over enabled agents. No delta                                                          |

Four tabs: Agents, Approval queue (count pill), Runs, Guardrails.

### Agents tab

Summary line: active, autonomous, need approval, paused. Then one card per agent:

- Avatar, name, module badge (Service Management, Service Health, Agent Operations, Knowledge, Change Management; `moduleLabel` in `lib/ai/agents.ts`), health badge (Healthy green, Degraded amber, Paused amber), description, enable switch (tooltip "Pause agent" / "Resume agent").
- Metric tiles: Runs 24h; Actions with "N% of runs"; Time saved with "N min / action".
- Acceptance rate meter: green at or above 90 percent, brand colour at or above 80, amber below.
- Autonomy radio group: Suggest, Act with approval, Autonomous, with the description of the selected level underneath. Disabled while the agent is paused.
- Tool chips (`read_incident`, `create_incident`, `update_tool_permissions`, and so on; these are the agent's own tool names, not the Tools & MCP registry).
- Footer: trigger ("On incident created", "Every 60 seconds", "Nightly and on prompt publish", "Weekly and on new tool grant") and "Last run <time ago>".

### Approval queue tab

Proposal cards, two columns on large screens:

- Agent avatar and name, "proposed <time ago>", impact badge (Low impact grey, Medium impact amber, High impact red).
- Action title and rationale.
- Proposed change: a diff table of `field: from → to` when the proposal carries one.
- Confidence meter: green at or above 85 percent, brand at or above 70, amber below.
- Record link (`INC…`, `CHG…`, `agt-…`), Reject, Review (link to the record), Approve.

Sample proposals worth knowing: p5 from Prompt Hygiene asks to "Re-run the helpdesk golden set on p-27 for IT Helpdesk Copilot" (p-27 is that agent's production version; the proposal is about re-scoring it after the open topic-mix drift, not about pinning another agent's version). `lib/ai/guardrails.test.ts` checks that every `p-N` named in a proposal belongs to the agent the proposal is about.

"Queue at a glance" card: counts by impact as metric tiles (high in red when above zero), proposals per agent, and a line explaining that approving or rejecting moves the proposal to the activity list with your name and does not change the underlying record. Empty state when the queue is clear.

### Runs tab

Run history is a `DataTable` (toolbar and pagination hidden, sr-only caption) with Agent, Run (summary, record link, tool call count), Trigger, Duration, Tokens, Outcome badge and When, sorted newest first. Outcomes map to badges: succeeded shows Complete, needs-approval shows Pending Approval, failed shows Failed, skipped shows Canceled.

Right column: "Actions per day" stacked bars for the last 7 days (Autonomous, Approved, Rejected) and an "Activity" card with the latest 7 entries: agent, summary, record link, time, actor, and an outcome badge (applied shows Complete, approved shows Approved, rejected shows Rejected, suggested shows Draft, failed shows Failed, undone shows Canceled). The card says it covers workflow agents only; deployed-agent events live in the Audit Log.

### Guardrails tab

"Model & autonomy" card:

| Setting                                | Control                                                                                                           | Default           | Effect in this template                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model                                  | Select over the curated models in `lib/ai/agents.ts` with tier; description underneath                            | Claude Sonnet 5.5 | Selects the assistant's model label; the scripted engine does not change                                                                                                                 |
| Default autonomy for new agents        | Select: Suggest, Act with approval, Autonomous                                                                    | Act with approval | Labelled "Planned": stored only, applies once agents can be registered from this page                                                                                                    |
| Daily action budget                    | Slider 50 to 2,000 in steps of 50, with a meter of today's use (red at or above 90 percent, amber at or above 70) | 500               | Once `actionsToday` (sum of `actions24h` over enabled agents) reaches the budget, actions applied from AgentOps Assist queue for approval instead of applying                            |
| Require approval for high-risk actions | Switch                                                                                                            | on                | High-risk suggested actions in the assistant queue for approval                                                                                                                          |
| Redact personal data                   | Switch                                                                                                            | on                | E-mail addresses, phone numbers and IBANs in a prompt are masked (`redactPii` in `lib/ai/assistant.ts`) before the assistant processes it; a toast reports how many values were replaced |
| Show reasoning in chat                 | Switch                                                                                                            | on                | Hides or shows the assistant's reasoning steps                                                                                                                                           |

"Allowed tools" card: seven checkboxes with risk badges and tool ids, count pill `N / 7`: Read records (low), Search knowledge (low), Update fields (medium), Create records (medium), Change agent config (high), Send notifications (high), Close or retire (high). Default allowed: the first four. Every scripted tool call in the assistant is mapped to one of these categories (`toolCategoryFor` in `lib/ai/agents.ts`); a call whose category is unchecked is rendered as "(skipped)" with the reason in its output instead of running.

"Usage" card: three metric tiles, Runs (sum of `runs24h` over enabled agents), Tokens (sum of `tokens24h`), Avg latency (mean duration of the sampled runs).

## What to check

### Every day

- Awaiting your approval. Work the queue oldest first; the stat card tells you the age of the oldest proposal. A proposal older than a shift is an agent whose work is being wasted.
- High impact proposals (red count in "Queue at a glance"). Read the diff and the rationale, open the record with Review, then decide. Do not approve a high-impact change from the dashboard preview card without opening the record.
- Health badges on the Agents tab. Degraded means the agent's recent runs failed or were skipped (Eval Regression Sentinel in the mock data). Sort the Runs table by Outcome and read the Failed rows.
- Daily action budget meter on the Guardrails tab. At or above 70 percent before mid-day, assistant actions will start queuing for approval before the day ends; raise the budget deliberately or accept the queue.
- Runs with outcome Failed. The summary says what failed; the record link shows what state it left behind.

### Every week

- Acceptance rate per agent. Below 80 percent (amber meter) means people are rejecting or rewriting most of what the agent proposes; move it from Autonomous to Act with approval, or from Act with approval to Suggest, until the rate recovers.
- Autonomous agents versus the allowed tools list. An agent that is Autonomous and holds a high-risk tool (send notifications, close or retire, change agent config) should only stay autonomous if "Require approval for high-risk actions" is on.
- Activity entries with outcome Canceled (undone). An undone action is a wrong action that reached production; find the agent and lower its autonomy or tighten its trigger.
- Actions per day chart. A rising Rejected band with flat Approved means the agent is proposing more without getting better.
- Paused agents (Major Incident Comms in the mock data). Confirm the pause is intentional and documented; a paused comms agent during a P1 is a gap.
- Time saved figures. They are `actions × avgSavedMinutes`; if the per-action minutes were never measured, treat the card as directional.

### Before a release or model change

- Model setting on the Guardrails tab. Changing it changes the assistant for every user and the default for new workflow agents at once. Check the model in the Model Catalog for tool use and JSON schema support first.
- Set every agent that touches the released system to Act with approval for the first day after the release, then restore.
- Allowed tools: remove Change agent config and Close or retire from the allowed set during a release window so the assistant cannot alter configuration or close records while humans are changing them.
- Redact personal data must stay on if the release introduces a model or provider outside the current data processing agreement.
- Tool Permission Auditor and Prompt Hygiene should be enabled and healthy; they are the agents that catch a bad release's side effects on tool grants and prompts.

## Actions

Agents, proposals and activity are React state in `AiProvider`; they reset on reload. Settings persist in the browser.

| Action                                                 | Where         | What happens in this template                                                                                                                               |
| ------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pause all agents / Resume all agents                   | Header        | Sets `enabled` on every agent to the opposite of "any enabled". Paused agents get health Paused; resumed agents that were Paused become Healthy             |
| Model catalog                                          | Header        | Navigates to `/ai/models`                                                                                                                                   |
| Open Assist                                            | Header        | Opens the assistant panel on the chat tab                                                                                                                   |
| Enable switch                                          | Agent card    | Toggles `enabled` and adjusts health as above                                                                                                               |
| Autonomy radio                                         | Agent card    | Sets `autonomy` to suggest, approve or autonomous                                                                                                           |
| Approve                                                | Proposal card | Removes the proposal, prepends an activity entry with outcome approved and actor "You", toast "Approved … Moved to the activity list." No record is changed |
| Reject                                                 | Proposal card | Removes the proposal, prepends an activity entry with outcome rejected, toast "Rejected … Moved to the activity list."                                      |
| Review                                                 | Proposal card | Navigates to the record                                                                                                                                     |
| Model, Default autonomy, Daily action budget, switches | Guardrails    | Update `AiSettings`, persisted under the `agentops:ai-settings` key through `lib/store.ts`                                                                  |
| Allowed tools checkboxes                               | Guardrails    | Update `AiSettings.allowedTools`; the assistant skips tool calls in unchecked categories                                                                    |

## Reading the data

Agent fields (`AiAgent`):

| Field                          | Meaning                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| module                         | ITSM, ITOM, AgentOps, Knowledge, Change; displayed through `moduleLabel` as Service Management, Service Health, Agent Operations, Knowledge, Change Management            |
| autonomy                       | suggest: drafts recommendations, a person applies them. approve: prepares the action and waits for one-click approval. autonomous: acts immediately and logs every change |
| enabled                        | Paused agents do not run                                                                                                                                                  |
| tools                          | The agent's own capability names                                                                                                                                          |
| trigger                        | Event or schedule that starts a run                                                                                                                                       |
| runs24h, actions24h, tokens24h | Runs, resulting actions and model tokens in the last 24 hours                                                                                                             |
| acceptanceRate                 | Percent of proposals approved or left unchanged                                                                                                                           |
| avgSavedMinutes                | Estimated minutes saved per action, used for the Time saved cards                                                                                                         |
| health                         | Healthy, Degraded, Paused                                                                                                                                                 |

Proposal fields (`AgentProposal`): `recordNumber` and `recordHref`, `action`, `rationale`, `confidence` 0 to 1, `impact` low, medium or high, optional `diff` of field changes.

Run fields (`AgentRun`): `outcome` succeeded, needs-approval, failed, skipped; `trigger`; `durationMs`; `toolCalls`; `tokens`.

Activity fields (`AgentActivity`): `outcome` applied, approved, rejected, suggested, failed, undone; `actor` when a person decided.

Thresholds in the UI: acceptance meter green at or above 90, brand at or above 80, amber below; confidence meter green at or above 85 percent, brand at or above 70, amber below; budget meter red at or above 90 percent used, amber at or above 70; high-impact count red above zero.

## How the data gets here

Module: `lib/ai/agents.ts`.

Types: `AiAgent`, `AiAgentModule`, `Autonomy`, `AgentProposal`, `AgentActivity`, `AgentRun`, `AgentRunOutcome`, `AiModel`, `ModelProvider`, `ToolCatalogId`. Exports: `agents` (9 workflow agents), `moduleLabel`, `proposals` (6), `agentActivity`, `agentRuns`, `runOutcomeMeta`, `usageByDay` (7 days), `models` (curated picker list with `openRouterId`), `providerMeta`, `tierMeta`, `getModel`, `toolCatalog` (7 entries with risk), `toolCategoryFor`, `getAgent`, `autonomyMeta`.

State: `components/ai/ai-provider.tsx` seeds `agents`, `proposals` and `activity` into React state and exposes `updateAgent`, `decide` and `actionsToday`. `AiSettings` (modelId, catalogModel, defaultAutonomy, requireApprovalForHighRisk, piiRedaction, dailyActionBudget, allowedTools, showReasoning) lives in a persisted store created by `lib/store.ts` under `agentops:ai-settings`; the panel's open state and tab live under `agentops:assistant`.

To wire a backend: map `agents`, `proposals`, `agentRuns` and `agentActivity` onto your agents service and replace `updateAgent` and `decide` with mutations that also write the audit event. Enforce `dailyActionBudget`, `allowedTools`, `piiRedaction` and `defaultAutonomy` server-side; the client-side enforcement here is a preview of the contract. The scripted assistant in `lib/ai/assistant.ts` is a separate swap.

## Related pages

- Model Catalog (`/ai/models`): extends the model select with any OpenRouter model.
- Tools & MCP (`/agentops/tools`): the registry the Tool Permission Auditor reviews; its permission matrix is the deployed-agent equivalent of the allowed tools card.
- Prompts (`/agentops/prompts`): Prompt Hygiene proposals land as prompt versions.
- Evals & Datasets (`/agentops/evals`) and Drift & Quality (`/agentops/drift`): where the Eval Regression Sentinel opens signals.
- Costs & Budgets (`/agentops/costs`) and Recommendations (`/agentops/recommendations`): where Cost Guardian proposals point.
- Incidents (`/itsm/incidents`), Alerts (`/itom/alerts`), Changes (`/itsm/changes`), Knowledge (`/itsm/knowledge`): the records the Service Management, Service Health, Change Management and Knowledge agents act on.
- Audit Log (`/agentops/audit`): the hash-chained record for deployed-agent changes; the activity card on this page covers workflow agents only.
