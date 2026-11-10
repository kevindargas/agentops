# Fleet Overview

The Fleet Overview is the landing page for Agent Operations. It rolls every production agent up into one screen: traffic, quality, spend, review backlog, error-budget burn, run outcomes and the health of the telemetry pipeline itself. It also hosts the two fleet-wide emergency controls (kill switch and write freeze).

It is the page an on-call platform engineer opens first in the morning and the page a team lead checks before approving a model or prompt change. Everything on it links down to the page where the detail lives (agents, traces, drift board, experiments, recommendations).

## Where to find it

- Nav group: Agent Operations, first entry ("Fleet Overview").
- Route: `/agentops`.
- Keyboard chord: `G` then `O` (defined in `config/nav.ts`, handled in `components/layout/command-menu.tsx`; the second key must follow within 1.2 s). Also reachable from the command menu (`Cmd/Ctrl K`) under the Agent Operations group.
- Code: `app/(app)/agentops/page.tsx` renders the header and `features/agentops/fleet-overview.tsx`.

## What is on the page

Page header actions:

| Button | Effect |
| --- | --- |
| Explore traces | Link to `/agentops/traces`. |
| Register agent | Opens the "Register agent" sheet (name, team, model id, framework, description). Submitting appends a staging agent with zero traffic to the shared agent store, so it appears in the Agents table and stat cards for this session. |

Below the header, top to bottom:

1. **Attention banner.** Only rendered when at least one production agent is paused or has a health other than `Healthy`. Lists each agent by name (linked to its record) with its health (or "paused") in parentheses, plus an "Open drift board" button to `/agentops/drift`. Pausing an agent anywhere in the app adds it here immediately.

2. **Fleet controls strip.** Two switches, "Kill switch" and "Writes disabled", with a one-line description under each. The strip shows "All clear. Both controls off." or "Emergency control engaged" and turns red-bordered when either control is on. A trailing line shows when the controls last changed and by whom. Engaging a control opens a confirmation dialog; releasing one is immediate.

3. **Primary stat row** (`StatGrid` with four default-size cards, no icons, production agents only). Deltas come from `compareWindows` in `lib/data/metrics.ts` over `fleetDaily`:

| Card | Value | Delta | Hint |
| --- | --- | --- | --- |
| Requests · 24h | Sum of `metrics.requests24h` | % change, last 7 days vs prior 7 days of `fleetDaily.requests` ("vs prior 7 days") | "N production agents · N errors" (errors = error rate x requests) and a 14-day sparkline |
| Quality score | Traffic-weighted mean of `metrics.quality`, out of 100 | Points change, last 7-day mean vs prior 7-day mean of `fleetDaily.quality` | "Traffic-weighted evaluator composite" and a 14-day sparkline |
| Spend · day | Sum of `metrics.costPerDay` | % change vs prior 7 days; an increase is shown as bad | "About $X / month at current traffic" and a 14-day sparkline |
| Awaiting review | `pendingReviewCount` over the shared review store (moves as you review) | none | "N drift signals · N experiments running" from the drift and experiment stores; the card links to `/agentops/reviews` |

4. **Secondary stat row** (`StatGrid`, four compact cards):

| Card | Value | Hint / behaviour |
| --- | --- | --- |
| Agents burning error budget | Count of production agents with `errorBudget.burnRate1h > 2`, shown as "N / total" | Hint names the worst agent with its burn multiple and % budget left and explains that above 2x the 28-day budget runs out early; the card links to that agent. The number is tinted with the worst agent's budget tone. When nobody is burning: "All agents within 2x burn (1x spends the 28-day budget exactly on pace)". |
| Outcomes · 24h | Traces started in the last 24 h with outcome `completed`, shown as "N / total completed" | "N partial, refused or failed"; links to `/agentops/traces` |
| Trace coverage | `telemetryHealth.traceCoverage` % | "N% spans dropped · N export failures" |
| Ingestion lag p95 | `telemetryHealth.ingestionLagP95S` seconds | Hint reads "Traces may lag behind live traffic" when above 60 s, otherwise "Span end to queryable" |

5. **Traffic and reviews** chart. Stacked bars for the last 30 days: "Served" (requests minus reviewed) and "Human reviewed" (`fleetDaily.reviewed`).

6. **Quality trend** chart. Fleet composite score line, last 30 days (`fleetDaily.quality`).

7. **Outcomes (24h)** chart. Stacked bars in six 4-hour UTC buckets. Outcomes are folded into five series: Completed, Partial, Refused, Failed (tool error, timeout, rate limited, invalid output) and Abandoned. Series with zero traces in the window are omitted. The "Traces" button links to `/agentops/traces`; the traces table has the full per-outcome split.

8. **Agents** card. Production agents sorted by requests, one row each: name (linked), framework badge, model chip, request count, p95 latency, quality score bar, health badge (`Paused` when the agent is paused). "All agents" links to `/agentops/agents`.

9. **Spend by model.** Horizontal bars of cost per day grouped by `modelId` across production agents.

10. **Needs a decision.** Count pill is open recommendations (status `New` or `Testing`) plus running experiments, read from the shared stores. Shows up to two open recommendations (title linked to `/agentops/recommendations?open=<rec-id>`, confidence, age) and up to two running experiments (name linked to `/agentops/experiments?open=<exp-id>`, P(B > A), agent chip).

## What to check

### Every day

- **Attention banner.** Any agent listed here is `Degraded`, `Drifting` or `Paused` in production. Open the agent record; if it is `Drifting`, go to the drift board and acknowledge or resolve the signals; if `Degraded`, look at its error rate and open tool-error traces.
- **Fleet controls.** Both switches should be off and the strip should say "All clear". If either is engaged, confirm there is an active incident that justifies it; the strip tells you who engaged it and when. Release it as soon as the incident allows.
- **Agents burning error budget.** Should be 0. Anything above 0 means an agent is spending its 28-day budget faster than 2x pace. Open the linked agent and read the SLO card; the footer text tells you to page the owner when burn exceeds 2x.
- **Outcomes · 24h.** Compare completed to total. A rising "partial, refused or failed" count with flat traffic points at a tool, provider or prompt regression. Click through to traces and facet by outcome.
- **Trace coverage and ingestion lag.** Coverage should stay above roughly 99% and lag under 60 s (the card turns its hint into a warning above 60 s). Lower coverage or higher lag means every other number on this page is stale or under-counted; fix the collector before trusting the dashboard.
- **Requests · 24h delta.** A large negative delta without a known reason usually means an upstream channel (Slack, Teams, web) stopped sending traffic; a large positive delta should be matched by a spend increase and not by a quality drop.
- **Awaiting review.** Watch the trend rather than the absolute number; a growing backlog means reviewers are behind or an agent is flagging too much. Open the review queue.

### Every week

- **Quality trend (30 days).** The fleet composite should be flat or rising. The sample data shows a slow decline over the last five days, which is what a regression looks like; correlate the start of the decline with deployments and prompt changes.
- **Spend by model.** Confirm the most expensive model is the one you expect. A cheap model climbing the list means traffic moved (a fallback firing, or a routing rule changed).
- **Spend · day delta vs prior week.** An increase is shown as bad. Match it against the traffic delta; spend growing faster than traffic means longer runs, more tool loops or a model change.
- **Traffic and reviews.** The reviewed share should be stable (about 2.8% in the sample). A sudden increase means an agent's review rate or guardrail flags changed.
- **Needs a decision.** Clear it. Running experiments that already show high significance should be promoted or stopped; open recommendations should be accepted, tested or dismissed.

### Before a release or model change

- No agent in the attention banner, no agent burning budget, both fleet controls off.
- Outcomes (24h) shows a normal distribution for the agent you are changing, so you have a clean baseline to compare against after rollout.
- Trace coverage near 100% and ingestion lag under 60 s, so the post-release traces will arrive in time to catch a regression.
- Check "Needs a decision" for an experiment on the same agent; promote or stop it before deploying so the change is not confounded.

## Actions

| Control | What it does in this template |
| --- | --- |
| Register agent | Opens the registration sheet; submitting adds a staging agent to the shared agent store (see [Agents](agents.md)). |
| Explore traces | Navigates to `/agentops/traces`. |
| Kill switch (switch on) | Opens a confirmation dialog ("Engage the fleet kill switch?") explaining that every agent stops accepting new runs, in-flight runs finish, schedules and triggers are skipped, users see a maintenance message, and that the change is recorded on this page with your name and the time for the rest of the session. Confirming updates local state, stamps "changed just now" by `currentUser` and shows a warning toast ("Kill switch engaged"). |
| Writes disabled (switch on) | Confirmation dialog ("Disable all write-capable tools?"): agents keep answering but any create/update/delete tool is refused with a policy message. Same local-state behaviour and warning toast; the confirm button reads "Disable writes". |
| Either switch off | Immediate, success toast ("... released"). |
| Open drift board | Navigates to `/agentops/drift`. |
| All agents / Traces / card links | Navigation only. |

Fleet control toggles are local to the browser session. Reloading the page returns to the values in `fleetControls`. The dialog does not claim an audit entry; the only record is the "Changed ... by ..." line on the strip.

## Reading the data

- **Health badge**: `Healthy` (green), `Degraded` (amber), `Drifting` (amber), `Paused` (amber). Only non-`Healthy` production agents make the banner.
- **Quality score bar** (`ScoreBar`): green at 90 or above, amber at 80 to 89, red below 80.
- **Error budget tone** (`budgetTone` in `features/agentops/agent-config/agent-slo-card.tsx`): red when `remaining <= 0.1` or `burnRate1h > 4`; amber when `remaining <= 0.4` or `burnRate1h > 2`; green otherwise. The "burning" count uses `burnRate1h > 2`.
- **Deltas**: `compareWindows(series, 7)` from `lib/data/metrics.ts` over `fleetDaily` (30 daily rows). Requests and cost are percentage changes (`deltaPct`), quality is the difference of the 7-day means (`delta` with `mean`). For spend, up is bad; for requests and quality, up is good.
- **Outcome groups** in the 24 h chart: `completed`; `partial`; `refused`; `tool_error`, `timeout`, `rate_limited`, `invalid_output` together as "Failed"; `abandoned`. Partial and refused are still successful runs from the platform's point of view; the chart description says so.
- **Trace coverage**: share of runs that produced a complete trace. **Dropped span rate**: share of spans the collector dropped. **Export failures**: exporter errors in the last 24 h. **Ingestion lag p95**: seconds between span end and the span being queryable; 60 s is the warning threshold.
- **Needs a decision**: open means recommendation status `New` or `Testing`; experiments count when status is `Running`.

## How the data gets here

Everything is read from `lib/data/agentops.ts` directly (the component is a client component, so it never imports the `lib/data` barrel):

- `agentStore` (`features/agentops/stores.ts`, seeded from `deployedAgents`; `DeployedAgent` in `lib/types.ts`, including `metrics`, `health`, `paused`, `errorBudget`, `modelId`), so agents paused or registered elsewhere in the session show up here.
- `agentTraces` (`AgentTrace`, used for the 24 h outcome chart and the completed count).
- `reviewStore`, `driftStore`, `experimentStore`, `recommendationStore` (same stores module) for the counters and the decision list.
- `fleetControls` (`FleetControls`) for the control strip's initial state.
- `telemetryHealth` (plain object: `sampleRate`, `traceCoverage`, `droppedSpanRate`, `exportFailures24h`, `ingestionLagP95S`).
- `fleetDaily` (30 rows of `name`, `requests`, `errors`, `reviewed`, `quality`, `cost`) for the sparklines, deltas and 30-day charts; `compareWindows` and `mean` from `lib/data/metrics.ts` for the deltas.
- `NOW` from `lib/data/seed.ts` is the fixed clock (2026-11-05T14:30Z) used for the 24 h window and for relative times; `clock()` stamps fleet-control changes and `currentUser` (`lib/data/users.ts`) is the actor.

To wire a backend, replace `lib/data/agentops.ts` with API clients returning the same types. The component is a client component, so either pass the fetched data in as props from `app/(app)/agentops/page.tsx` or fetch inside with your data layer. Replace the `apply` function in `FleetControlsStrip` with a mutation that flips the control server-side and writes the audit event; keep the confirmation dialog.

## Related pages

- [Agents](agents.md) for per-agent SLOs, run limits and configuration.
- [Traces](traces.md) for the outcome split and individual runs.
- [Review Queue](review-queue.md) for the "Awaiting review" backlog.
- [Drift & Quality](drift-and-quality.md) for the signals behind `Drifting` health.
- [Experiments](experiments.md) and [Recommendations](recommendations.md) for the "Needs a decision" list.
- Govern: Costs & Budgets (`/agentops/costs`) for spend beyond the per-model bar chart; Audit Log (`/agentops/audit`) where fleet-control changes should land once wired.
