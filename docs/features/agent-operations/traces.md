# Traces

A trace is one agent run: the user's request, the final answer, every span the framework emitted (router, retriever, LLM call, tool call, guard), tokens, cost, evaluator scores, what actually happened to the run (outcome), which run limit stopped it if any, streaming behaviour, and the exact lineage (code SHA, prompt version, parameter hash, index build, tool schema versions, policy version) needed to reproduce it.

The list page is where you go when a metric moved and you need examples. The detail page is where you debug a single run or decide whether to send it to human review.

## Where to find it

- Nav group: Agent Operations, "Traces". No keyboard chord.
- List route: `/agentops/traces`; add `?agent=<agt-id>` to scope the page to one agent (the title becomes "Traces · <agent name>" and the Agent facet is removed). `?status=`, `?outcome=` and `?flag=` preselect the matching facet, so `/agentops/traces?status=Failed` lands on failed runs. Code: `app/(app)/agentops/traces/page.tsx`, table in `features/agentops/traces-table.tsx`.
- Detail route: `/agentops/traces/[id]` where ids look like `tr_3f0000` (`loading.tsx` renders `RecordSkeleton`). Code: `app/(app)/agentops/traces/[id]/page.tsx`, header actions in `features/agentops/trace-actions.tsx`, waterfall in `features/agentops/trace-waterfall.tsx`, badges in `features/agentops/shared.tsx`.
- The command menu (`Cmd/Ctrl K`) searches traces once you type a query and opens the detail page.
- Entry points elsewhere: "Traces" on an agent record, "Traces" per agent on the drift board, "Open trace" in the review queue, "Explore traces" and the outcome card on the fleet overview.

## What is on the page

### List page

A `StatGrid` of four cards, scoped to the agent when `?agent=` is present:

| Card | Value | Hint |
| --- | --- | --- |
| Traces · 48h | Count of traces | "Sampled at N% · N% complete" from `telemetryHealth.sampleRate` and `traceCoverage` |
| p95 latency | 95th percentile of `durationMs` across the listed traces | "1 in 20 runs is slower than this" |
| Failed | Count with status `Failed` | "% of runs" |
| Spend | Sum of `cost` | "N awaiting human review" (status `Needs review`) |

Table columns (default sort: Started, newest first; 20 rows per page, 10 in the compact embed on an agent record):

| Column | Content | Notes |
| --- | --- | --- |
| Trace | Trace id in monospace | Always visible |
| Request | `userQuery` truncated, with agent chip, channel and an `A` / `B` badge when the run belonged to an experiment | Not sortable |
| Status | `Succeeded`, `Failed`, `Needs review`, `Reviewed` badge plus a thumbs up or down icon when the user gave feedback | |
| Outcome | Outcome badge plus a "bound hit" flag when a run limit ended the run | Sorted in a fixed order: completed, partial, refused, invalid output, tool error, timeout, rate limited, abandoned; header hint explains the vocabulary |
| Grounded | 0 to 1 evaluator score bar | Green at 0.85 or above, amber at 0.70 to 0.84, red below 0.70; header hint defines the score |
| Latency | `durationMs` | |
| Tokens | tokens in plus tokens out | Hidden in the compact embed |
| Cost | USD with three decimals | Hidden in the compact embed |
| Model | Model chip | Hidden by default; enable from View |
| Version | Agent build that served the run | Hidden by default; enable it to compare runs across a release |
| Started | Relative time | |

Facets:

| Facet | Options |
| --- | --- |
| Agent | Every deployed agent (removed when the page is scoped with `?agent=`) |
| Status | Succeeded, Needs review, Reviewed, Failed |
| Outcome | Completed, Partial, Refused, Invalid output, Tool error, Timeout, Rate limited, Abandoned |
| Bound hit | The bounds the seed actually produces (Max steps, Deadline, No progress) plus None; built from the data so no option is empty |
| Flag | Every entry of `traceFlags` (Low confidence, Hallucination risk, Missing citation, Policy: PII, Tool error, Long latency) |
| Version | Every agent version present in the data |
| Channel | Web, Slack, Teams, Email, API |
| Feedback | Thumbs up, Thumbs down, No feedback |

Search matches trace id, request text, final answer, session id, version, flags and the outcome label. Clicking a row opens the detail page; middle-click opens it in a new tab. Selecting rows shows a "Send to review" bulk action that queues the traces in the shared review store (see Actions). Keyboard: `/` focuses search, `Escape` clears the selection. The table carries a screen-reader caption ("Agent traces").

### Detail page

**Header.** Trace id, the user query as the title; the back arrow returns to `/agentops/traces?agent=<id>` so the agent scope survives. Badges (all `StateBadge`): status, outcome, bound-hit flag (if any), "Thumbs-up" or "Thumbs-down" (if the user gave feedback), and one amber badge per flag. Meta line: Agent (chip), Started (relative), Duration (amber when longer than the agent's p95), Cost and total tokens, Channel.

Header actions:

| Action | Shown when | Effect |
| --- | --- | --- |
| In review queue · <status> | A `ReviewItem` in the shared review store references this trace | Link to `/agentops/reviews?item=<rev-id>`, which opens that item |
| Send to review | No review item exists | Adds a `Pending` item (reason "User thumbs-down" or "Random sample", assigned to you) to the shared review store; the button turns into "In review queue · Pending" and the toast offers "Open queue" |
| Variant A / Variant B | The trace has `experimentId` | Link to `/agentops/experiments?open=<exp-id>` |
| More: Replay in playground | always | Link to `/agentops/playground?agent=<id>` |
| More: Open golden set | always | Link to `/agentops/evals?tab=datasets&dataset=<evalDataset>` |
| More: Open prompt | The agent has a prompt | Link to `/agentops/prompts/<prm-id>` |
| More: Copy trace JSON | always | Writes the full trace (spans, lineage, streaming) to the clipboard with `navigator.clipboard`; success toast, or an error toast when the clipboard is unavailable |

**Aside (right column).**

- *Evaluator scores*: Grounded, Helpful (green at 0.85 or above, amber from 0.70) and Safe (green only at 0.99 or above, amber from 0.90, red below).
- *Run*: Model, Version (linked to `/agentops/deployments?agent=<id>`), Session id (copyable), Started (absolute, UTC), LLM calls with tokens in and out, Experiment (linked, or "None").
- *Lineage* ("Exact versions needed to reproduce this run"): Code (7-character SHA, copy gives the full SHA), Prompt (version linked to the prompt page), Params (hash of the `ModelParams` used, copyable), Index build id (or "None" when the agent has no retriever), Policy version (linked to `/agentops/guardrails?tab=policies`), Tool schemas (one chip per tool as `name@version`, each linking to `/agentops/tools?tool=<name>`).
- *Guardrail violations*: only when `guardrailViolations` reference this trace. One row per violation: policy name linked to `/agentops/guardrails?policy=<grd-id>&tab=violations`, action and verdict badges, severity and the redacted snippet.
- *Streaming* (`MetricTile`s): only for channels that stream (Web, Slack, Teams). Time to first token (amber above 1500 ms), Throughput in tok/s, Client "Connected" or "Disconnected" (red), Stream "Complete" or "Truncated" (amber).
- *Path through graph*: the agent graph with the nodes this run visited at full opacity and the rest dimmed.

**Main column.**

- *Conversation*: the user turn and the agent's final answer. The answer bubble is tinted red when the status is `Failed`.
- *Spans*: "N spans · total duration" and the waterfall.

**Span waterfall** (`TraceWaterfall`). Scrolls horizontally below about 36rem so the timing bars keep their proportions on a phone. A header with time ticks at 0, 25, 50, 75 and 100% of the trace, then one row per span: an expand chevron, a node-type icon, the span name, an error icon when `status` is `error`, a finish-reason badge for LLM spans whose reason is not `stop` (red for `error` and `content_filter`, amber for `length`, grey for `tool_calls`), an arrow icon when the model alias resolved to a different concrete model, a proportional bar coloured by node type (red on error; the root span bar is dimmed), and the duration. The first errored span is expanded on load. Expanding a row shows Input, Output (red on error), Timing (start → end), Model (requested → response model when they differ, tokens in and out, cost, finish reason) and Attributes as `key=value` chips.

## What to check

### Every day

- **Failed card.** Compare the percentage against the agents' error-rate thresholds (3%). Facet Status = Failed, then Outcome, to see whether failures are `Tool error` (a downstream system), `Timeout` (run limits or a slow provider) or `Rate limited` (provider quota). Open one of each and read the errored span's Output.
- **Outcome facet, Bound hit facet.** Any `Timeout` with bound `Deadline`, or `Partial` with `Max steps`, `Cost budget` or `No progress`, is a run that was cut off by the agent's limits. A cluster of them after a deploy means the new version loops or the model got slower; see the agent's run limits before raising them.
- **Needs review count** (Spend card hint). It should be drained by the review queue each day.
- **Flags facet = Policy: PII.** These are runs the guard touched. Each one should either be `Refused` or have a review item. Open the Policy guard span and check `pii_redacted` and `verdict` in its attributes.
- **Feedback = Thumbs down.** Read a handful. If the final answer is fine and the thumbs-down is noise, nothing to do; if the Grounded score is red, the retrieval index is the suspect.

### Every week

- **Grounded column sorted ascending.** Anything under 0.62 also carries "Missing citation". A growing count on one agent matches a quality drift signal.
- **Latency sorted descending** with the "Long latency" flag. Traces slower than the agent's p95 show an amber Duration in the header. Expand the slowest span in the waterfall; in the sample data the LLM span dominates for RAG agents and the tool span for tool agents.
- **Model column (enable it) and the alias arrow in the waterfall.** If `responseModelId` differs from `requestedModelId` on many runs, the provider is serving a dated snapshot or your fallback model is firing (8% fallback in the mock). That changes cost and quality without any deploy on your side.
- **Streaming section on a sample of Web/Slack/Teams traces.** TTFT above 1.5 s is amber; `Disconnected` clients mean users gave up (outcome `Abandoned`); `Truncated` streams with finish reason `length` mean `maxOutputTokens` is too low.
- **Channel facet.** Email and API runs never stream; a sudden shift of traffic between channels explains latency and cost changes.

### Before a release or model change

- Pick five to ten representative traces per agent (one per intent in the Request column) and add them to the golden set ("Open golden set" in the trace overflow leads to the dataset) so the release is evaluated against real traffic.
- Record the current Lineage of a healthy trace (code SHA, prompt version, params hash, index build, policy version, tool schema versions). After the release, open a new trace and confirm every lineage field changed as intended and nothing else did.
- Check Bound hit = None dominates for the agent. If runs already brush against `Deadline` or `Max steps`, a slower or more verbose model will tip them over; adjust `RunLimits` on the agent record first.
- Compare the "Path through graph" of a few runs against the graph you expect the new version to take (for example, a new guard node should appear in the path).
- For experiments, use the `A` / `B` badge in the Request column and the Variant button in the header to confirm the traffic split is landing on both variants.

## Actions

| Where | Action | Effect in this template |
| --- | --- | --- |
| List, selection bar | Send to review | Calls `queueTraceForReview` for each selected trace (skipping traces already queued); toast "N traces added to the review queue" with an "Open queue" action; clears the selection. The items are `Pending` in the shared store, so the Review Queue and its stat cards show them immediately |
| Detail header | In review queue · <status> | Navigation to `/agentops/reviews?item=<rev-id>` |
| Detail header | Send to review | Adds one review item to the shared store (see above) |
| Detail header | Variant A / B | Navigation to the experiment sheet |
| Detail overflow | Replay in playground, Open golden set, Open prompt | Navigation |
| Detail overflow | Copy trace JSON | Real clipboard write of the trace JSON |
| Run and Lineage sections | Copy icons on Session, Code, Params | Copy the value to the clipboard (handled by `DetailList`) |
| Run and Lineage | Version, Prompt version, Policy version, tool schema chips | Navigation to `/agentops/deployments?agent=`, the prompt page, `/agentops/guardrails?tab=policies` and `/agentops/tools?tool=<name>` |
| Guardrail violations | Policy name | Navigation to `/agentops/guardrails?policy=<grd-id>&tab=violations` |
| Waterfall | Click a row | Expands that span and collapses the previously open one |

## Reading the data

**Status vs outcome.** `TraceStatus` is the review-workflow state: `Succeeded` (green), `Failed` (red), `Needs review` (amber), `Reviewed` (green). `TraceOutcome` is what actually happened to the run:

| Outcome | Badge tone | Meaning |
| --- | --- | --- |
| Completed | green | Normal completion |
| Partial | amber | The run stopped early but returned something; usually a run limit (`boundHit`) or a missing citation |
| Refused | blue | The model or guard declined (finish reason `content_filter`); still an ok run |
| Invalid output | red | Output failed the contract (in the mock the last LLM span finishes with `length`) |
| Tool error | red | A tool call failed (HTTP 504 in the sample attributes) |
| Timeout | red | The run exceeded its deadline or the provider timed out |
| Rate limited | amber | Provider throttled the request |
| Abandoned | grey | The client disconnected before the stream finished |

**Bound hit** (`BoundHit`): `max_steps` "Max steps", `deadline` "Deadline", `cost_budget` "Cost budget", `no_progress` "No progress". Shown as an amber flag with a stop icon next to the outcome; the title text reads "Run stopped by the ... limit". It is only set when a `RunLimits` bound ended the run.

**Flags** (`TraceFlag`, the `traceFlags` tuple in `lib/data/agentops.ts`). In the mock generator: "Low confidence" when grounded is below 0.70, "Missing citation" when below 0.62, "Policy: PII" when the safe score is below 1, "Tool error" on failed runs, "Long latency" when the duration exceeds the agent's p95. "Hallucination risk" when grounded is below 0.68 while helpful is above 0.88 (a confident answer with weak grounding).

**Evaluator scores** (`evals`, 0 to 1): `grounded`, `helpful`, `safe`. Grounded and Helpful use thresholds 0.85 and 0.70; Safe uses 0.99 and 0.90 because anything below a near-perfect safety score matters.

**Lineage** (`TraceLineage`): `codeSha` (Git SHA of the agent build), `promptVersion` (for example `p-41`), `paramsHash` (digest of the `ModelParams` used), `indexBuildId` (retrieval index build, absent for agents without a retriever), `toolSchemaVersions` (tool name to schema version), `policyVersion` (guardrail policy, `default-v3` in the sample).

**Streaming** (`TraceStreaming`): `ttftMs` time to first token (warning above 1500 ms), `tokensPerSec`, `disconnected` (client went away; true for `abandoned` outcomes), `truncated` (stream cut short by a length limit, disconnect or the kill switch).

**Spans** (`TraceSpan`): `type` is the graph node type; `status` is `ok`, `error` or `skipped`; LLM spans carry `modelId`, `requestedModelId`, `responseModelId`, `finishReason` (`stop`, `length`, `tool_calls`, `content_filter`, `error`), `tokensIn`, `tokensOut`, `cost`; retriever spans carry attributes `index`, `top_k`, `hits`, `min_score`; tool spans carry `tool` and `status_code`; guard spans carry `pii_redacted`, `policy`, `verdict`. Span `s0` is the root (the whole run); the rest are its children, indented one level.

**Channel** (`TraceChannel`): Web, Slack, Teams, API, Email. Scheduled agents (Alert Correlator, Knowledge Curator) always report API.

## How the data gets here

- `agentTraces` and `getTrace(id)` from `lib/data/agentops.ts`. The module generates 140 traces over the last 48 hours with seeded randomness, weighted toward busier agents; outcome, bound hit, flags, spans, lineage and streaming are derived together so they stay consistent.
- The detail page also reads `getDeployedAgent` and `getExperiment` from the same module, `guardrailViolations` and `getGuardrail` from `lib/data/guardrails.ts`, and `getPromptForAgent` from `lib/data/prompts.ts` for the prompt link. Review state comes from `reviewStore` and `queueTraceForReview` in `features/agentops/stores.ts` (client side), so a trace sent to review from the list or the detail page is `Pending` everywhere in the session.
- Outcome and bound labels, the `OutcomeBadge`, `BoundHitFlag` and `finishReasonLabel` live in `features/agentops/shared.tsx`; the badge colours are entries in `stateTone` in `components/shared/status-badge.tsx`.
- Types: `AgentTrace`, `TraceSpan`, `TraceStatus`, `TraceOutcome`, `BoundHit`, `TraceLineage`, `TraceStreaming`, `TraceChannel`, `FinishReason`, `SpanStatus` in `lib/types.ts`.

To wire a backend: replace `agentTraces` and `getTrace` with a client over your trace store (the shape is close to an OpenTelemetry or LangSmith export: spans with type, timing, tokens, cost, inputs, outputs and attributes). The list page is a server component and can `await` the query, passing `data` into `TracesTable`. Replace `queueTraceForReview` with the mutation that creates a review item; "Copy trace JSON" already uses the clipboard and the overflow links need no backend.

## Related pages

- [Agents](agents.md) for the run limits that produce bound hits and the p95 the Duration tone is compared against.
- [Review Queue](review-queue.md) for the human verdict on `Needs review` traces.
- [Experiments](experiments.md) for the variant a trace belonged to.
- [Drift & Quality](drift-and-quality.md) for the signals that usually send you here.
- [Fleet Overview](fleet-overview.md) for the 24 h outcome chart.
- Build: Prompts (lineage prompt version), Tools & MCP (tool schema versions). Govern: Guardrails (policy version and PII flags), Evals & Datasets (where "Add to eval set" should land).
