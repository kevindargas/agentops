# Agent Operations

Agent Operations is the group of pages for running deployed AI agents as production services: a fleet view, the agent inventory and records, every run as a trace, a human review queue, drift and quality signals, A/B experiments and evidence-backed recommendations. All seven pages live under `/agentops` and read from `lib/data/agentops.ts`; in this template that module is deterministic mock data. Write actions update module-scoped client stores in `features/agentops/stores.ts` (agents, reviews, drift signals, experiments, recommendations, semantic definitions), so stat cards, tables and badges on the same page move together; a reload returns to the seed.

## Pages

| Page | Route | What it is for |
| --- | --- | --- |
| [Fleet Overview](fleet-overview.md) | `/agentops` | Cross-agent traffic, quality, spend, error-budget burn, run outcomes, telemetry health, and the fleet-wide kill switch and write freeze |
| [Agents](agents.md) | `/agentops/agents`, `/agentops/agents/[id]` | Inventory of deployed agents; per-agent SLOs, error budget, run limits, generation parameters, tools, guardrails, knowledge, schedule, plus embedded traces, experiments and recommendations |
| [Traces](traces.md) | `/agentops/traces`, `/agentops/traces/[id]` | One row per run with status, outcome, bound hit, evaluator scores and cost; span waterfall, lineage and streaming detail per trace |
| [Review Queue](review-queue.md) | `/agentops/reviews` | Human verdicts on sampled and flagged answers with a four-criterion rubric; approve, flag, correct, skip with keyboard shortcuts |
| [Drift & Quality](drift-and-quality.md) | `/agentops/drift` | Input, output, quality, tool and cost signals against each agent's 28-day baseline, with acknowledge and resolve |
| [Experiments](experiments.md) | `/agentops/experiments` | A/B tests on model, prompt, retrieval or tooling with per-variant metrics, daily chart, significance and promotion |
| [Recommendations](recommendations.md) | `/agentops/recommendations` | Proposed model and configuration changes with evidence, confidence, savings and a link to the testing experiment |

Shortcuts that matter here: `Cmd/Ctrl K` opens the command menu, which searches agents and traces by name or id and lists every page. `G` then `O` jumps to the Fleet Overview. Inside any table, `/` focuses the search box and `Escape` clears a selection. The review queue has its own keys (`1` to `5`, `A`, `F`, `C`, `S`, `Enter` to save a correction, `Esc` to cancel one); it claims those keys so the global `C` quick-create shortcut does not fire at the same time.

Cross-links use stable id prefixes: agents `agt-…`, traces `tr_…`, experiments `exp-…`, review items `rev-…`, drift signals `drf-…`, recommendations `rec-…`, prompt versions `p-N`, semantic entities `sem-…`.

## Operator checklist

### Every day

Start on the Fleet Overview and work outward.

- [ ] Fleet Overview: no attention banner. If an agent is listed, open its record (Degraded: error rate and tool-error traces; Drifting: drift board; Paused: confirm the reason is still valid).
- [ ] Fleet Overview: both fleet controls off. If one is engaged, confirm there is a live incident; release as soon as possible.
- [ ] Fleet Overview: "Agents burning error budget" is 0. Otherwise open the linked agent's SLO card; burn above 2x means page the owner.
- [ ] Fleet Overview: trace coverage near 99% or above and ingestion lag under 60 s. If not, fix the collector before trusting anything else.
- [ ] Fleet Overview: Outcomes 24h shows mostly Completed; any growth in the failed group gets a traces look faceted by Outcome.
- [ ] Agents: Errors column has no red (above 3%); Drift column has no red (PSI 0.25 or above, or an open Critical drift signal).
- [ ] Traces: Failed card percentage is in line with the agents' error rates; open one `Tool error`, one `Timeout` and one `Rate limited` trace and read the errored span. Check the Bound hit facet for runs cut off by run limits.
- [ ] Drift: Critical counter is 0; every Open signal older than a day is acknowledged by someone.
- [ ] Review Queue: priority 1 (Policy match) and priority 2 (User thumbs-down) items are cleared; the pending count is not growing day over day.
- [ ] Experiments: any running experiment at 95% or above is decided (Promote B or Stop); no variant with a higher error rate than control is still running.
- [ ] Recommendations: any Deprecation item has an owner and a date before the provider's cutoff.

### Every week

- [ ] Fleet Overview: 30-day quality trend is flat or rising; spend by model matches expectations; the reviewed share of traffic is stable; "Needs a decision" is empty.
- [ ] Agents: open each production agent's Quality tab; no steady 14-day decline. Error budget remaining above 40% for every agent you plan to change. Budgets card "Today" is under 70% of the daily cap. Every production agent has an owner and a reasonably recent deploy.
- [ ] Traces: sort by Grounded ascending and by Latency descending on each agent; look for alias-resolved models in the waterfall (requested vs response model) and for truncated or disconnected streams.
- [ ] Review Queue: average rubric score at 4/5 or above; the reason mix has not shifted toward evaluator flags or thumbs-downs; every Flagged item produced an action; corrections from this week are in the golden set.
- [ ] Drift: acknowledged signals each have an owner and a plan and are not still trending the wrong way; Info signals that are explained are resolved; resolved signals had a cause.
- [ ] Experiments: drafts have a start date or are abandoned; Completed experiments with winner B are promoted; secondary metrics (cost, error rate) of running variants are acceptable.
- [ ] Recommendations: no New item older than two weeks; items at 90% or above with all-green evidence are applied or dismissed with a reason; Testing items agree with the verdict of their experiment.

### Before a release or model change

For the agent being changed:

- [ ] Agent record: health Healthy, not paused, error rate under 3%, error budget above 40%, 1 h burn under 2x. The Configuration tab shows no "unsaved vs deployed" parameters.
- [ ] Agent record: run limits (max steps, deadline, cost budget, no-progress steps) are sized for the new model's latency and verbosity; compare against the current p95 and the Bound hit facet on recent traces.
- [ ] Agent record: autonomy level is appropriate (write-capable tools at "Act with approval" unless signed off); golden set and prompt version in the Evaluation section are the ones the release was tested against.
- [ ] Traces: save five to ten representative recent traces to the eval set; note the current lineage (code SHA, prompt version, params hash, index build, policy version, tool schema versions) so you can confirm what changed afterwards.
- [ ] Review Queue: pending items for this agent are drained so the pre-release approval rate and rubric baseline are complete; corrections are in the eval set.
- [ ] Drift: no Open or Acknowledged signals on the agent, or the ones the release is meant to fix are written down; recent input drift means the eval set may not match current traffic.
- [ ] Experiments: no other running experiment on the agent; if the change was tested, significance is at 95% or above with B winning and the experiment id is recorded with the release.
- [ ] Recommendations: no open recommendation points the agent in a different direction; no Deprecation notice on the target model; mark the driving recommendation Applied after rollout.
- [ ] Fleet Overview: trace coverage and ingestion lag are healthy so post-release traces arrive in time to catch a regression; both fleet controls are off and you know who can engage them if needed.

## Wiring real data

Every page in this group imports from `lib/data/agentops.ts` (client components import the module directly, never the `lib/data` barrel). Replace that module with API clients returning the same types from `lib/types.ts` (`DeployedAgent`, `AgentTrace`, `TraceSpan`, `ReviewItem`, `DriftSignal`, `Experiment`, `ModelRecommendation`, plus `fleetControls`, `telemetryHealth` and `fleetDaily`), and the component layer keeps working. Mutations are concentrated in `features/agentops/stores.ts`: the `createListStore` instances (`agentStore`, `reviewStore`, `driftStore`, `experimentStore`, `recommendationStore`, `semanticStore`) and the factories `queueTraceForReview` and `draftExperiment`. Replace their `patch`, `add` and `set` calls with API calls and every page keeps its optimistic behaviour. The remaining per-component local state is the fleet-controls strip, generation-parameter and run-limit edits on the agent record, and the correction and rubric drafts in the review workspace.
