# Operator checklist

This is the working checklist for the person who runs the AgentOps platform. Every item names the page to open, what a healthy reading looks like, what a bad reading looks like and the first thing to do. Thresholds come from the code that renders the pages (`lib/data/agentops.ts`, `lib/data/costs.ts`, `lib/data/evals.ts`, `lib/data/deployments.ts`, `lib/data/providers.ts`, `lib/data/schedules.ts`, `lib/readiness/metrics.ts`), not from a generic playbook. Where the code has no hard threshold, the value given is the one the sample data treats as the boundary.

Use the "G then key" chords in the sidebar to move quickly: G O fleet, G R review queue, G G guardrails, G E evals, G P prompts, G T tools, G Y readiness, G I incidents, G Q requests, G H service health. Every count you act on in a session (approvals, review verdicts, acknowledged alerts) moves on every page that shows it, and resets on reload; sidebar badges are live counts from the same data.

## Every morning

### 1. Fleet Overview

Open [Fleet Overview](features/agent-operations/fleet-overview.md) (`/agentops`).

- **Emergency controls strip.** Good: both "Kill switch" and "Writes disabled" show their off state ("Agents accept new runs", "Tools may write to downstream systems"). Bad: either control is engaged and nobody owns the reason. Engaging either one opens a confirmation dialog that spells out the consequence; releasing is immediate. First action: find the audit event for the toggle (source `agent-config`) and confirm with the person named in `changedBy` before releasing it.
- **Agents needing attention.** Good: the banner is absent. Bad: "N agents need attention" lists agents whose health is Degraded, Drifting or Paused. First action: open each agent and read the SLO card; Paused agents carry a `pausedReason`.
- **Outcomes, 24h.** Good: the completed share is in the high nineties and the hint "partial, refused or failed" is a small number. Bad: a rising count of `tool_error`, `timeout`, `rate_limited` or `invalid_output` outcomes. First action: open Traces filtered by outcome and look at which agent dominates.
- **Trace coverage.** Good: at or above 99 percent (the readiness metric `trace-coverage` warns below 99, critical below 95). Sample value is 99.4 percent with 0.3 percent spans dropped, 2 export failures and a 100 percent sample rate (`telemetryHealth`). Bad: coverage under 99, or export failures climbing. First action: treat it as a telemetry incident; the fleet numbers below it are only as good as the pipeline.
- **Ingestion lag p95.** Good: under 60 seconds (the card switches its hint to "Traces may lag behind live traffic" above 60). Sample is 41 s. Bad: above 60 s. First action: do not make rollback decisions on stale traces; check the collector before anything else.
- **Error budgets.** On each agent record the SLO card turns warning when remaining budget is at or below 40 percent or the 1-hour burn rate is above 2x, and danger when remaining is at or below 10 percent or burn is above 4x. First action on danger: pause new releases for that agent and open the traces from the last hour.

### 2. Review Queue depth

Open [Review Queue](features/agent-operations/review-queue.md) (`/agentops/reviews`).

- Good: pending items fit in one sitting; nothing older than a day with priority 1 or 2. Bad: pending items with reason "Evaluator flag" or "Policy match" are aging, or the sidebar badge keeps growing day over day. The sample queue holds 58 items, 36 of them pending; the sidebar badge is that pending count.
- First action: sort by priority, work the P1 and P2 items with the keyboard (1 to 5 for the rubric, A approve, F flag, C correct, S skip, Enter saves a correction, Esc cancels). Every verdict moves the Pending and Reviewed cards and the badge immediately and can be undone from the toast for six seconds. Corrections are saved to the eval set, so a correction is more valuable than a flag.

### 3. Drift signals

Open [Drift & Quality](features/agent-operations/drift-and-quality.md) (`/agentops/drift`).

- Good: no Critical signals in state Open. Warning signals are acknowledged and have an owner. Bad: an Open Critical signal, especially an `input` or `quality` kind, since those usually precede a quality incident. The sample has one: "Topic mix shift (PSI)" on IT Helpdesk Copilot, baseline 0.04, current 0.31.
- First action: read the explanation, click Acknowledge (the signal moves to Acknowledged in the shared drift store, so the Critical counter and the agent record update at once), then follow the [drift runbook](knowledge-base/runbooks/handle-a-drift-signal.md). Do not Resolve a signal until the metric has returned to its baseline band. The fleet quality baseline the board compares against is `fleetQualityBaseline` (89.5).

### 4. Guardrail violations

Open [Guardrails](features/govern/guardrails.md), Violations tab (`/agentops/guardrails?tab=violations`).

- Good: Critical violations from the last 24 hours all have a verdict (Verified or Dismissed). Blocked actions outnumber Flagged ones for input policies. Bad: Pending verdicts piling up, or a policy with a false-positive rate high enough that reviewers stop reading it. Also check `failMode`: a `fail_open` policy that errored overnight let traffic through unguarded.
- First action: open the trace behind each Pending Critical violation, set the verdict (each verdict toast offers Undo for eight seconds and appends a `guardrail.violation.*` audit event), and if the policy is noisy adjust its threshold on the Policies tab rather than disabling it. Disabling a policy asks for confirmation.

### 5. Failing evals

Open [Evals & Datasets](features/govern/evals-and-datasets.md) (`/agentops/evals`).

- Good: the most recent run per agent on its golden dataset is Passed with zero regressions; the release gate card for every production agent reads Passed. Bad: a Failed run with regressions above zero, or a gate rule failing. The five gate rules are composite score at or above 85 (`GATE_THRESHOLD`), zero regressions on the golden set, 100 percent pass on PII-leak probes, p95 latency within the agent's budget (2.5 s to 25 s depending on the agent) and cost per case within budget ($0.02 to $0.40). A failed gate carries a reason: in the sample, Knowledge Curator's pending release `rel-1033` scores 87 but fails with "1 regression on kb-draft-v4". Draft releases (`rel-1012`, `rel-1037`) have no gate yet.
- First action: open the run, sort the case grid by Regression, and read the judge rationale. If a prompt change caused it, the fix is a new prompt version; if a model change caused it, open the matching experiment or recommendation.

### 6. Budget alerts

Open [Costs & Budgets](features/govern/costs-and-budgets.md), Budgets tab (`/agentops/costs?tab=budgets`).

- Good: every budget is "On track". Bad: "At risk" means the linear projection is at or above 90 percent of the limit; "Exceeded" means spend has already reached the limit and the breach action has fired (Alert only, Throttle, Downgrade model or Pause agent). Alert thresholds are per budget, typically 50 / 80 / 100 percent. The sample has 13 budgets with 6 at risk or exceeded (`budgetsAtRiskCount`), including the three daily caps (Support Triage, Ops Analyst, Alert Correlator) and "Policy Answers · monthly". Spend today is $571.20 (`costToday`), of which Anthropic carries $379.47.
- First action: open the budget, check which agent or model is driving the slope on the 30-day history, and follow the [budget breach runbook](knowledge-base/runbooks/respond-to-a-budget-breach.md).

### 7. Provider health

Open [Providers & Routing](features/govern/providers-and-routing.md) (`/agentops/providers`).

- Good: every provider card is Connected with a flat 14-day latency trend; no open provider incident in Investigating. Fallback hits on routing rules are low and stable. Bad: a Degraded provider, an incident in Investigating or Monitoring, or a routing rule whose `fallbackHits24h` jumped. Rate limits: any scope where used RPM or TPM is close to its cap, or `throttled24h` above zero. Routing strategies are Priority fallback, Weighted, Lowest latency, Lowest cost and Region-pinned; the sample's EU rule is "Policy Answers · EU region pinned" (`rt-004`).
- First action: confirm the fallback chain for affected agents is Active (Routing tab) and run the request simulator against the failing primary. Raise or re-balance rate limits only after confirming spend headroom.

### 8. Alerts and major incidents

Open [Alerts](features/service-health/alerts.md) (`/itom/alerts`) and [Incidents](features/service-management/incidents.md) with the Major incidents view (`/itsm/incidents?view=major`).

- Good: no unacknowledged Critical or Major alerts; no open major incident touching a system an agent depends on (`ciId` on the incident). Bad: an alert storm on one node, or a major incident on a service the agents read from (Payments API, identity, knowledge stores). The sample has 40 alerts, 17 open (the sidebar badge) and 8 unacknowledged (`openAlertCount`, `unacknowledgedAlertCount`).
- First action: select the rows and acknowledge or create an incident in bulk (closing in bulk asks for confirmation); the stat tiles and the badge follow the shared alert store. Then check whether affected agents should be paused or have writes disabled until the incident is resolved. Pausing an agent asks for a reason and confirmation.

## Every week

### Experiments ready to promote

Open [Experiments](features/agent-operations/experiments.md).

- Good: Running experiments have enough requests on both variants and the significance (probability that B beats A on the primary metric) is at or above 0.95 (`SIGNIFICANCE_THRESHOLD`) before anyone promotes. Completed experiments with a winner are either promoted or stopped within the week. The sample has two running experiments ready to decide (0.97 and 0.96) and one promoted retrieval experiment.
- First action: for each candidate, follow [promote an experiment](knowledge-base/runbooks/promote-an-experiment.md). Promote and Stop both open a confirmation dialog. Promotion creates work in Prompts or Deployments; it is not finished when the toast appears.

### Recommendations

Open [Recommendations](features/agent-operations/recommendations.md).

- Good: no recommendation sits in New for more than a week; `deprecation` kinds are acted on before the vendor date. Bad: high-confidence cost recommendations ignored while budgets are At risk.
- First action: move a recommendation to Testing by starting an A/B test from it (drafts an experiment with the default 20 percent split, `defaultExperimentSplit`), or dismiss it with a reason.

### Prompt hygiene

Open [Prompts](features/build/prompts.md).

- Good: exactly one `production` version per prompt, the production version has an eval score, draft versions are either promoted or archived, and every `{{variable}}` is documented in the variables panel. Bad: production versions with `evalScore` null, prompts whose latest version is weeks old while the agent's quality trend is falling, or versions with review state Pending Approval that nobody owns.
- First action: run the eval for unscored production versions; diff stale drafts against production and archive the ones that lost.

### Tool permissions

Open [Tools & MCP](features/build/tools-and-mcp.md).

- Good: the agents x risk permission matrix has `deny` or `approval` for every Destructive row, Write tools have `approval` unless the agent is explicitly trusted, tools with `pendingApprovals` are being worked, and every MCP server shows `signatureVerified` true, a reviewed definition digest and zero critical vulnerabilities. Bad: a Destructive tool on `allow`, a server whose `definitionDigest` changed since `reviewedAt`, an `eolDate` in the past, or a tool with `outputSinks` containing `renders_html` or `executes_code` without a matching output guardrail.
- First action: tighten the matrix cell, then sign off or disconnect the server (revoking credentials asks for confirmation). Export the matrix for the weekly record: Download writes `tool-policy.json`, Copy JSON puts the same document on the clipboard.

### Stale and expiring API keys

Open [Providers & Routing](features/govern/providers-and-routing.md), Keys tab.

- Good: no key in Expiring with fewer than 14 days left; `lastUsed` within the last week for Active keys; Revoked keys show no spend. The sample has three expiring keys: `openrouter-shared` in 3 days, `gateway-prod-openai` in 9 days and `kb-curator-bedrock` in 12 days. Bad: an Active key with no use in 30 days (unused credentials), or a key whose scopes exceed what the agents need.
- First action: follow [rotate an API key](knowledge-base/runbooks/rotate-an-api-key.md). Rotate and Revoke both ask for confirmation; the old key stays valid for `keyRotationGraceHours` (24). Revoke unused keys.

### Cost forecast

Open [Costs & Budgets](features/govern/costs-and-budgets.md), overview.

- Good: the end-of-month forecast (linear projection from the trailing 14 full days, `forecastMonthEnd`) is under the sum of monthly team budgets (`monthlyBudgetTotal`). Cached-token savings are visible on the daily chart. Bad: forecast above total budget, or one agent's share of fleet cost rising week over week (`deltaPct` on the allocation table).
- First action: open Savings and apply the low-effort opportunities (routing, caching, output-token caps) before touching budgets.

### Knowledge ingestion

Open [Knowledge & Memory](features/build/knowledge-and-memory.md).

- Good: every knowledge base is Healthy, no source is Failed, every scheduled source synced on time, and no base is Stale (last sync older than 7 days, `STALE_AFTER_DAYS`). Retrieval hit rate and context precision are flat or rising. Bad: Failed ingestion jobs with errors, a Stale base behind a production agent, or a growing list of low-recall queries.
- First action: re-run the failed job, then open the low-recall queries and decide whether the fix is content (write the missing article) or retrieval settings (top-k, hybrid weight, threshold).

### Readiness review cadence

Open [Readiness Assessment](features/govern/readiness-assessment.md), Results tab.

- Good: the "reviews due" list is empty. Each control with a cadence (weekly, monthly, quarterly, semiannual) has a `lastReviewed` date inside its window. Bad: overdue reviews on controls marked In place or Verified, which means evidence is going stale.
- First action: review the overdue controls, update evidence and `lastReviewed`, take a snapshot.

## Before every release

Work through this gate before advancing a release past Draft. The release record shows most of it on one page.

1. **Eval gate.** Open the agent's release gate in Evals & Datasets. All five rules Passed on a run against the agent's golden dataset (not an older dataset version). The release's `evalGate.score` must be at or above its threshold. A Failed gate that is `enforced` blocks the release; do not flip enforcement to get around it.
2. **Guardrail coverage.** On the release record, "Guardrail coverage" is the share of the agent's guardrail suite that covers this change. Anything below 100 percent needs a written reason. If the release adds a tool, the Action category must be covered. For agents with external exposure, check the policies' `bypassRate` from the last red-team run (`lastRedTeamRunId`).
3. **Canary plan.** Strategy is Canary or Blue-green for production (Shadow for model swaps you are not sure about; Direct only for staging). Steps are explicit, for example 5, 25, 100. The rollout chart will plot quality and error rate for new and baseline at each step. See [deployment strategies](knowledge-base/concepts/deployment-strategies.md).
4. **Approvals.** Every approver on the release is `approved`. Risk High or Very High requires the Approvals tab entry to carry evidence: eval gate, experiment significance, guardrail coverage, cost delta. "Request changes" and "Reject" both stop the release (Reject returns it to Draft and needs a reason of at least ten characters). Decisions are shared between the release record and the Approvals tab within the session.
5. **Audit chain.** Open the Audit Log and press "Verify chain". The Chain integrity card must read Verified over the seed and over anything appended this session (records you caused on Guardrails, Evals or Deployments carry a "This session" badge). Every change in the release (prompt version, params, model, tools) should already appear as an audit event with an approval id in its context.
6. **Freeze windows.** Open [Schedules & Triggers](features/govern/schedules-and-triggers.md), calendar view. No freeze window overlaps the planned rollout. The sample calendar includes Black Friday (Nov 26 to Dec 1) and quarter-end (Dec 28 to Jan 4) freezes where production deploys are not allowed. `freezeAt(iso)` is the function the UI uses. The change calendar uses the same windows (`changeFreezeWindows`); the CAB meets Thursday 09:00 UTC (`cabSchedule`).
7. **Rollback target.** The release record names a `rollbackTarget` version that still exists in the environments matrix. Roll back opens a confirmation dialog and needs a reason of at least ten characters, which becomes the audit reason. Read [roll back a release](knowledge-base/runbooks/roll-back-a-release.md) once before you need it.
8. **Cost delta.** `costDeltaPct` on the release is within what the agent's budget can absorb for the rest of the period.

## Monthly and quarterly

### Readiness reassessment

- Monthly: update statuses on controls that changed, take a snapshot named for the month, compare with the previous snapshot in the Share tab.
- Quarterly: re-run the setup form if the system profile changed (autonomy, data sensitivity, exposure, regulatory scope), since applicability and required controls follow from it. Target `production` requires the full set; `pilot` and `prototype` require fewer. Export the Markdown report for the governance record. See [run a readiness assessment](knowledge-base/runbooks/run-a-readiness-assessment.md).

### Framework mappings

Open Readiness Assessment, Frameworks tab. Check that every OWASP LLM Top 10 item still maps to at least one control that is In place or Verified (the test suite enforces the mapping exists; you enforce the status). For EU AI Act or ISO/IEC 42001 scope, export the mapping with the quarterly report.

### Budgets

- Reset or re-baseline budgets whose limit no longer matches the forecast. Check that `onBreach` actions are still appropriate: "Pause agent" on a customer-facing agent is a service decision, not a finance one.
- Review savings opportunities marked Applied and confirm the saving shows up in the allocation table.

### Access review

- [Users & Groups](features/administration/users-and-groups.md): confirm owners on agents, prompts, budgets and keys are current employees in the right group (sample owners: Support Triage and Knowledge Curator u-002, IT Helpdesk Copilot u-020, Ops Analyst u-001 Kevin Dargas, Change Risk u-004, Policy Answers u-007, Alert Correlator u-018, Finance Copilot u-016). Deactivating a user asks for confirmation.
- [Tools & MCP](features/build/tools-and-mcp.md): review every `delegated` identity (scopes, `tokenTtlMin`) and every `service` identity that can write.
- [Providers & Routing](features/govern/providers-and-routing.md), Keys: every key has an owner, an expiry and scopes limited to what the routing rules need.
- [Audit Log](features/govern/audit-log.md): read the retention card. Retention is 400 days on WORM object storage with legal holds on four events (rollbacks and user-memory deletions); confirm `lastIntegrityCheck` is recent and the chain verifies over all 140 seeded events (`aud-000001` to `aud-000140`).
- [Knowledge & Memory](features/build/knowledge-and-memory.md): memory stores with `piiPolicy` other than `deny` and `writePolicy` of `agent-writable` deserve a look at their sample records.
