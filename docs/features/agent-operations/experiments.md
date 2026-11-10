# Experiments

Experiments are A/B tests on a single agent: a control (A) against a variant (B) that changes the model, the prompt version, the retrieval strategy or the tooling. Traffic is split per session so one user never sees both variants, a primary metric (quality, cost per 1K requests or p95 latency) is tracked daily, and the variant can be promoted once the probability that B beats A reaches 95%.

Agent owners run experiments; the platform team uses them as the release gate for model and prompt changes and as the evidence behind recommendations.

## Where to find it

- Nav group: Agent Operations, "Experiments". No keyboard chord.
- Route: `/agentops/experiments`. Append `?open=<exp-id>` (ids look like `exp-helpdesk-haiku`) to open an experiment's sheet on load; opening a row writes `?open=` and closing the sheet clears it, so the URL is always shareable. `?agent=<agt-id>` preselects the Agent facet (the agent record's "Start experiment" uses it). Code: `app/(app)/agentops/experiments/page.tsx` (with `loading.tsx` rendering `TableSkeleton`), table and sheet in `features/agentops/experiments.tsx`, state in `features/agentops/stores.ts` (`experimentStore`).
- The same table is embedded, scoped to one agent, in the Experiments tab of an agent record.
- Entry points with `?open=`: running experiments in the fleet overview's "Needs a decision" list, the "Variant A/B" button and Experiment link on a trace, "View experiment" on a recommendation.

## What is on the page

Three stat cards (`ExperimentStats`, a client `StatGrid` reading the same store as the table):

| Card | Value | Hint |
| --- | --- | --- |
| Running | Experiments with status `Running` | "N ready to decide" (significance at 0.95 or above) |
| Decided | `Completed`, `Promoted` or `Stopped` | "N variants won" (winner is B) |
| Drafts | Status `Draft` | "Created from drift signals and recommendations" |

Table (default sort: Started, newest first). Clicking a row opens the sheet instead of navigating.

| Column | Content | Notes |
| --- | --- | --- |
| Experiment | Name, with kind and agent name underneath | Always visible |
| Status | `Draft`, `Running`, `Completed`, `Promoted`, `Stopped` badge | |
| Split | A two-tone bar and "A/B" percentages, for example 70/30 | `split` is the share routed to B; header hint |
| A | Control's value of the primary metric, muted | Header hint: the deployed configuration |
| B | Variant's value of the primary metric | Green when B is better on the primary metric, red otherwise; empty while B has no traffic; header hint |
| Metric | Quality, Cost / 1K or p95 latency | |
| P(B > A) | Significance as a percentage | Coloured only at 95% or above: green if B wins, red if B loses; header hint explains the probability and the threshold |
| Requests | A plus B requests | Hidden by default |
| Owner | User chip | Hidden by default |
| Started | Date | |

Facets: Status (only statuses present in the seed), Kind (Model, Prompt, Retrieval, Tooling), Agent (removed in the agent-scoped embed). Search matches name, hypothesis, kind and agent name. The toolbar button "New experiment" is disabled; its tooltip explains that experiments start from a drift signal ("Start experiment") or a recommendation ("Start A/B test"), which prefill the agent and the hypothesis. The table has a screen-reader caption ("A/B experiments").

**Experiment sheet** (opens from a row or `?open=`):

- Header: status badge, kind badge, "Primary: <metric>" badge, agent chip, the experiment name and the hypothesis.
- *Verdict box*. For a Draft: "Not started. Variant B has no traffic yet; press Start to route N% of sessions to it." Otherwise one of three states, with a progress bar of the significance against a "95% threshold" label:
  - green, "Variant B is better with high confidence." (significance at 0.95 or above and B wins)
  - red, "Variant B is worse with high confidence." (significance at 0.95 or above and B loses)
  - amber, "Not enough evidence yet." (below 0.95), with "keep running until 95%" appended while Running
  The second line reads "N% probability that B beats A on <metric> · N requests observed".
- *Tests recommendation* chip, when a recommendation's `experimentId` points at this experiment, linking to `/agentops/recommendations?open=<rec-id>`.
- *Variants table*. Columns A and B with a trophy on the winner. Rows: Model (only for model experiments; "Same as A" when B keeps the model), Requests, Quality score, Thumbs up, p95 latency, Cost / 1K requests, Error rate. The better value in each row is green (higher quality and thumbs up, lower latency, cost and error rate); ties are not coloured.
- *<Metric> by day* line chart with one series per variant, shown when daily data exists.
- *Traffic to variant B*: toggles 5%, 10%, 20%, 30%, 50%. Enabled only while the experiment is `Running` or `Draft`. Caption: "Ramp gradually. Traffic is assigned per session so a user never sees both variants."
- Facts (`MetricTile`s): Owner, Started, Ends (while Running) or Ended ("Open" when no end date is set).
- Footer (standard sheet footer): a kind-specific "Finish on Prompts / Deployments / Knowledge / Tools" link on the left for Promoted and Completed experiments, Close, then Stop and Promote B (Running), Start (Draft) or Promote winner (Completed with winner B). See Actions.

## What to check

### Every day

- **Running card hint "ready to decide".** Any running experiment at 95% or above should be decided today: Promote B if the verdict is green, Stop if it is red. Leaving a losing variant running keeps serving worse answers to its share of users (the seeded Policy Answers experiment lost 6 quality points on 20% of traffic before it was stopped).
- **Verdict box of each running experiment.** Check that the request count is growing day over day; a flat count means the split is not being applied.
- **Error rate row in the variants table.** A variant with a higher error rate than control should be stopped even if the primary metric looks good; the primary metric does not include failures.
- **Split against blast radius.** A brand-new experiment at 50% on a production agent is risky; the caption says to ramp gradually. Lower it to 5 or 10% until the first day of data is in.

### Every week

- **Draft experiments.** Each draft should have a start date in the near future or be deleted (the template has no delete; it would stay a Draft). The seeded Change Risk tooling experiment is a draft with 0 requests; drafts created from drift signals and recommendations during the session also land here.
- **Completed but not promoted.** A `Completed` experiment with winner B still has a "Promote winner" button; decide or document why not.
- **Daily chart shape.** The two lines should be roughly parallel. A variant that wins only on some days usually means a traffic-mix effect; look at the day-of-week pattern and consider running longer.
- **Secondary metrics.** The primary metric is what the verdict uses; a variant that wins on quality but costs more (the seeded triage prompt p-42 is +0.6 quality at +7% cost) is a trade-off the owner must accept explicitly.
- **Experiments without a linked recommendation.** Open the recommendations page; running model experiments should have a `Testing` recommendation pointing at them.

### Before a release or model change

- Any change to a production agent's model, prompt version, retrieval or tooling should go through an experiment first. If one is running on the same agent, finish it; two concurrent changes cannot be attributed.
- Promote only at 95% or above with B winning. The "Promote B" button enforces this and its confirmation restates the significance, the primary-metric delta and the request count; do not bypass it by deploying manually.
- Record the experiment id in the release so the deployment page and the audit log can link to the evidence.
- After promotion, the agent's traces should stop carrying `A`/`B` badges; if they continue, the split did not reach 100%.

## Actions

| Action | Shown when | Effect in this template |
| --- | --- | --- |
| New experiment (toolbar) | always | Disabled with a tooltip pointing at the drift board and recommendations, which create drafts |
| Row click | always | Opens the sheet and writes `?open=<exp-id>`; closing clears it |
| Traffic to variant B toggles | Running or Draft | Updates `split` in the shared store; no toast |
| Start | Draft | Status becomes `Running`; success toast "Experiment started: N% of traffic now routes to variant B" |
| Stop | Running | Opens "Stop the experiment?" naming the split that returns to control and whether A is recorded as the winner. Confirming sets `Stopped` (winner A unless B was ahead); toast with Undo |
| Promote B | Running | Disabled until significance is at 0.95 or above and B wins (the tooltip says so). Opens "Promote variant B?" with the significance, the A to B values of the primary metric, the request count and a reminder to check the eval gate. Confirming sets `Promoted`, winner B, split 100; success toast names the "Finish on ..." step |
| Promote winner | Completed with winner B | Same confirmation; status becomes `Promoted`, split 100 |
| Finish on Prompts / Deployments / Knowledge / Tools | Promoted or Completed | Link to `/agentops/prompts/<prm-id>`, `/agentops/deployments?agent=<id>`, `/agentops/knowledge?tab=bases` or `/agentops/tools?tab=permissions` by kind |

All changes live in `experimentStore` for the session (the stat cards, the fleet overview and the recommendation cards read it); a reload returns to the seeded list. Promotion does not change the agent's `modelId` or `promptVersion` on the agent record.

## Reading the data

**Kind** (`ExperimentKind`): `model` (different `modelId` per variant), `prompt` (different `promptVersion`), `retrieval`, `tooling`.

**Status** (`ExperimentStatus`): `Draft` (grey), `Running` (accent), `Completed` (green), `Promoted` (green), `Stopped` (grey).

**Primary metric** (`ExperimentMetric`) and direction:

| Metric | Field on the variant | B wins when |
| --- | --- | --- |
| quality | `quality` (0 to 100 evaluator composite) | B is higher |
| cost | `costPer1k` (USD per 1K requests) | B is lower |
| latency | `p95Ms` | B is lower |

**Significance** (`significance`, 0 to 1): the probability that B beats A on the primary metric. 0.95 is the decision threshold everywhere in the UI (stat card hint, verdict colour, Promote button, table colouring).

**Variant fields** (`ExperimentVariant`): `key` A or B, `label` (shown without the "Control ·" / "Variant ·" prefix in the table header), `modelId` or `promptVersion`, `requests`, `quality`, `p95Ms`, `costPer1k`, `thumbsUp` (%), `errorRate` (%).

**Split**: share of traffic routed to B, 0 to 100. The table shows it as "100 minus split / split".

**Winner**: `A` or `B`, set when an experiment is decided. Stopping a running experiment sets winner A unless B was ahead at that moment.

**Daily**: array of `{ name, A, B }` readings of the primary metric; empty for drafts.

## How the data gets here

- `experiments` and `getExperiment(id)` from `lib/data/agentops.ts` (`Experiment`, `ExperimentVariant`, `ExperimentKind`, `ExperimentStatus`, `ExperimentMetric` in `lib/types.ts`), seeded into `experimentStore`. Five seeded experiments: a running model test with 97% significance, a running prompt test at 96%, a promoted retrieval test won by B, a stopped model test won by A, and a draft tooling test. `draftExperiment` in `features/agentops/stores.ts` appends drafts (control is the agent's current configuration, B has no traffic, split `defaultExperimentSplit`).
- Traces reference experiments through `AgentTrace.experimentId` and `variant`; recommendations through `ModelRecommendation.experimentId`.
- The page reads `searchParams.open` and `searchParams.agent` on the server and passes them as `initialOpenId` and `initialAgentFacet`; the table is keyed on them so a new `?open=` re-opens the sheet, and `syncUrl` mirrors the open sheet back into the URL with `history.replaceState`.

To wire a backend: replace `experiments` with your experimentation service (feature flags or a traffic router plus a metrics job that writes daily readings and a significance estimate). Replace the `experimentStore.patch` calls in `ExperimentSheet` with mutations for start, stop, promote and split changes, have promotion update the agent's deployed configuration, and make `draftExperiment` persist the drafts the drift board and recommendations create. Re-enable "New experiment" as a form once a create endpoint exists.

## Related pages

- [Recommendations](recommendations.md), which link to the experiment that tests them.
- [Agents](agents.md) for the Experiments tab and the configuration a promotion should change.
- [Traces](traces.md) for the `A`/`B` badge and the Variant button that lead here.
- [Drift & Quality](drift-and-quality.md), where "Start experiment" leads here.
- [Fleet Overview](fleet-overview.md) for running experiments in "Needs a decision".
- Build: Prompts (`/agentops/prompts`) for the prompt versions under test; Playground (`/agentops/playground`) for A/B compare before an experiment. Govern: Deployments (`/agentops/deployments`), Evals & Datasets (`/agentops/evals`).
