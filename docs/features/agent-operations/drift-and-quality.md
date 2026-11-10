# Drift & Quality

The drift board lists every signal where an agent has moved away from its own trailing baseline: the mix of inputs it receives, the shape of its outputs, evaluator quality, tool reliability and cost per request. Each signal carries a baseline, a current value, a 14-day history, a severity, a workflow state and a plain-language explanation of what moved, with links to the agent's traces and to the experiments page.

It is the page to open when the fleet overview shows an agent as `Drifting`, when the fleet quality line bends, or during the weekly quality review.

## Where to find it

- Nav group: Agent Operations, "Drift & Quality". No keyboard chord.
- Route: `/agentops/drift`. `?agent=<agt-id>` scopes the board and the title to one agent; `?state=Open|Acknowledged|Resolved|active|all` preselects the filter. Code: `app/(app)/agentops/drift/page.tsx`, board in `features/agentops/drift-board.tsx`, state in `features/agentops/stores.ts` (`driftStore`).
- Entry points: "Open drift board" in the fleet overview attention banner, "Board" and the Drift meta chip on an agent record (both carry `?agent=`).

## What is on the page

**Top row.**

- *Fleet quality vs baseline* chart: the fleet composite evaluator score for the last 14 days (`fleetDaily.quality`) against a flat baseline line at `fleetQualityBaseline` (89.5, exported by `lib/data/agentops.ts` and quoted in the chart description).
- A `StatGrid` of four cards: active signals by severity (`Critical`, `Warning`, `Info`; active means not `Resolved`) with the hint "N open · N acknowledged", and "Agents affected", the number of distinct agents with active signals out of the production agent count. The cards read the shared store, so Acknowledge moves the hint and Resolve moves the count.

**Filter row.** A toggle group with `active` (default; everything not `Resolved`), `Open`, `Acknowledged`, `Resolved`, `all`, plus the scoped agent with an "All agents" link when `?agent=` is set. To its right the caption: "Baselines are the trailing 28-day window per agent. PSI above 0.25 or a quality drop over 5 points raises Critical."

**Signal groups.** Signals are sorted by severity (Critical, Warning, Info) and then newest first, and grouped by agent. Each group has the agent chip, a signal count and a "Traces" button to `/agentops/traces?agent=<id>`. Inside, a two-column grid of signal cards. When nothing matches: "No drift signals" with either the all-clear sentence (active filter) or "No signals match this filter." and a "Show active signals" button.

**Signal card.**

| Element | Content |
| --- | --- |
| Kind label | Input drift, Output drift, Quality regression, Tool reliability or Cost anomaly, followed by the detection age |
| Metric | For example "Topic mix shift (PSI)", "Grounded score", "Tool error rate", "Cost per request" |
| Badges | Severity (`Critical`, `Warning`, `Info`) and state (`Open`, `Acknowledged`, `Resolved`) |
| Values | Baseline → current, with a % delta badge. The current value is red when the move is bad, green when it is good |
| Sparkline | 14-day history with the baseline drawn as a reference line; red when bad |
| Explanation | One or two sentences on what moved and why |
| Actions | Acknowledge (only when `Open`), Resolve (when not `Resolved`), Start experiment (when not `Resolved` and the kind is not `cost`) |

A `Critical` signal that is still `Open` has a red border. Resolved cards are dimmed.

## What to check

### Every day

- **Critical counter.** Should be 0. Every open Critical is either input drift with PSI at 0.25 or above or a quality drop of more than 5 points, or a tool error rate spike. Open the agent's traces from the group header and confirm with real examples, then Acknowledge so the rest of the team knows it is being handled.
- **Agents affected.** One agent with several signals (the seeded IT Helpdesk Copilot has input, quality and output signals that are the same story) is one incident; several agents each with a tool signal is a shared dependency problem (gateway, provider).
- **Open vs Acknowledged.** Anything `Open` for more than a day with nobody acknowledging is unowned. The age is on the card and the severity cards split open from acknowledged.
- **Tool reliability signals.** Read the explanation; the seeded one names the tool (`search_services`) and the cause (an API moved behind a new gateway). Check the Tools & MCP page for the tool's health and the trace waterfall for the 504s.
- **Cost anomaly signals.** Usually a consequence of another signal (the seeded one is the reflect → tools loop running 2.4x because tools time out). Fix the cause; do not raise the cost budget.

### Every week

- **Fleet quality vs baseline.** The quality line should sit on or above 89.5. The sample shows a decline starting about five days before "now"; if the line is below baseline for more than two or three days, look for a quality regression signal and a deploy or prompt change on that date.
- **Acknowledged signals.** Each one should have an owner and a plan. Acknowledged is not fixed; if the sparkline is still trending the wrong way, escalate.
- **Info signals.** Decide whether each is expected (the seeded "Answer length" signal is explained by a prompt change, and "Embedding centroid shift" was seasonal) and Resolve it, so the board stays readable.
- **Quality regression with an explanation that names a semantic-layer entity** (the seeded Ops Analyst signal points at a Draft entity). The fix is in the semantic layer, not the agent.
- **Resolved filter.** Scan what was resolved this week to make sure nothing was resolved without a cause being found.

### Before a release or model change

- The agent you are changing has no `Open` or `Acknowledged` signals, or you have written down which ones the release is meant to fix so you can resolve them afterwards.
- Read the agent's input drift signals. If the input mix already shifted (new topic cluster), the eval set the release was tested on may not represent current traffic; add recent traces to the eval set first.
- If the release changes the model, expect a cost signal and an output drift signal (answer length) in the following days; acknowledge them with the release as the reason rather than treating them as regressions.
- Check "Start experiment": for a quality, input, output or tool signal, the safer path is an experiment on the proposed fix rather than a straight deploy.

## Actions

| Action | Shown when | Effect in this template |
| --- | --- | --- |
| Acknowledge | State is `Open` | Sets the signal to `Acknowledged` in the shared `driftStore`; toast "Signal acknowledged" with the metric name and an Undo action |
| Resolve | State is not `Resolved` | Opens "Resolve this signal?" with a checkbox "This is the new normal: reset the baseline to the current value" and an optional reason. Confirming sets `Resolved` (and `baseline = current` when the box is ticked); toast "Signal resolved" repeats the baseline change and the reason, with Undo |
| Start experiment | State is not `Resolved` and kind is not `cost` | Creates a `Draft` experiment in the shared experiment store via `draftExperiment` (kind from the signal: input to retrieval, output and quality to prompt, tool to tooling; hypothesis names the metric, baseline and signal id; split `defaultExperimentSplit`) and navigates to `/agentops/experiments?open=<exp-id>` |
| Traces (group header) | always | Link to `/agentops/traces?agent=<id>` |
| Filter toggles | always | Filter the visible signals; the severity cards count active signals regardless of the filter |

State changes live in `driftStore` for the browser session and reset on reload; the fleet overview's "Awaiting review" hint reads the same store for its drift count.

## Reading the data

**Kind** (`DriftKind`) and what the metric usually is:

| Kind | Label | Typical metric and unit | Bad direction |
| --- | --- | --- | --- |
| `input` | Input drift | PSI of topic mix or embedding centroid shift, unitless | Up |
| `output` | Output drift | Thumbs-down rate %, answer length in words, refusal rate % | Up |
| `quality` | Quality regression | Grounded score (0 to 1), SQL validation failures % | Down for scores; the card treats any `quality` signal as bad when current is below baseline |
| `tool` | Tool reliability | Tool error rate % | Up |
| `cost` | Cost anomaly | Cost per request in $ | Up |

The red/green tint uses this rule: for `quality` signals the move is bad when `current < baseline`; for every other kind it is bad when `current > baseline`. The seeded "Refusal rate" output signal fell, so it is shown green.

**Severity** (`DriftSeverity`): `Critical` (red), `Warning` (amber), `Info` (blue). Severity is stored on the signal; the board does not recompute it. The caption states the intended rule: PSI above 0.25 or a quality drop of more than 5 points is Critical. The agent record and agents table use the same PSI thresholds for the Drift column (amber at 0.10, red at 0.25).

**State** (`DriftState`): `Open` (blue), `Acknowledged` (blue), `Resolved` (green).

**Baseline**: the trailing 28-day window per agent, per the caption. Resolving with "new normal" ticked overwrites the signal's `baseline` with its `current` value for the session. The fleet chart's baseline is `fleetQualityBaseline` from `lib/data/agentops.ts`, the same centre the `fleetDaily` generator uses.

**Delta badge**: `(current - baseline) / baseline` as a percentage, rounded to a whole number.

**History**: 14 daily values; the sparkline draws the baseline as a reference.

## How the data gets here

- `driftSignals` from `lib/data/agentops.ts` (`DriftSignal` in `lib/types.ts`), seeded into `driftStore`: nine hand-written signals covering all five kinds and all three states, with seeded 14-day histories. `openDriftSeverity(agentId)` from the same module colours the Drift column on the Agents page from these signals.
- `fleetDaily` and `fleetQualityBaseline` (same module) for the fleet quality chart; `deployedAgents` for the production count in "Agents affected".
- Severity and state badge colours are entries in `stateTone` (`components/shared/status-badge.tsx`).

To wire a backend: replace `driftSignals` with a query against your drift detector (PSI on input embeddings or topics, evaluator score windows, tool error rates, cost per request), keeping the `DriftSignal` shape including `history` and `explanation`. Replace the `driftStore.patch` calls (acknowledge, resolve with reason and baseline reset) with mutations, make `fleetQualityBaseline` come from the same service, and have `draftExperiment` call your experimentation service so "Start experiment" opens a persisted draft.

## Related pages

- [Agents](agents.md) for the Drift (PSI) column and the agent record's "Open drift signals" section.
- [Traces](traces.md) to see the runs behind a signal (Grounded column, Tool error outcome, Long latency flag).
- [Experiments](experiments.md) where "Start experiment" leads.
- [Review Queue](review-queue.md) to confirm quality drift with human verdicts.
- [Fleet Overview](fleet-overview.md) for the attention banner and 30-day quality trend.
- Build: Semantic Layer (`/agentops/semantic-layer`) for Draft entities that cause SQL validation failures; Knowledge & Memory (`/agentops/knowledge`) when the explanation says the index has no coverage. Govern: Guardrails, Costs & Budgets.
