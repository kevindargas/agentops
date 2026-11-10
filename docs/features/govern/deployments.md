# Deployments

Every prompt, model, tool, parameter or retrieval change to an agent ships as a release. A release records the before and after configuration, the eval gate result, who approved it, the rollout strategy, and the health of the new version against the old one while traffic moves over. Promotion is a deliberate step; rollback is one click.

The page is for agent owners who ship changes, the platform lead and AI governance reviewers who approve them, and the on-call engineer who needs to know what changed and how to undo it.

## Where to find it

- Sidebar: Govern > Deployments. The header is `<PageHeader nav="/agentops/deployments" />`, so eyebrow ("Govern"), icon and the "Deployments" title come from `config/nav.ts`.
- Routes:
  - `/agentops/deployments`, the list page with three tabs.
  - `/agentops/deployments/<rel-id>`, the release record (ids look like `rel-1021`). Releases drafted in the current session (`rel-1038` upward) resolve through the client release store; unknown ids show the not-found state.
- Query parameters on the list page:
  - `?tab=releases|environments|approvals`. Default `releases`. Switching tabs writes the parameter back with `router.replace`, so it round-trips like the other Govern pages.
  - `?agent=agt-<id>` pre-selects the Agent facet on the Releases tab and tints the agent's row on the Environments tab. The release record's "Rollback target" links here with `tab=environments`.
- Files: routes `app/(app)/agentops/deployments/page.tsx` and `app/(app)/agentops/deployments/[id]/page.tsx` (each with a `loading.tsx`: `TableSkeleton` and `RecordSkeleton`), UI `features/agentops/deployments/*`, data `lib/data/deployments.ts`, client stores `features/agentops/deployments/store.ts`.

## What is on the page

### Stat cards (list page)

A `StatGrid` of six cards rendered by the client `DeploymentsView` from the release store, so approving, rolling back or drafting a release moves them.

| Card | Value | Hint |
| --- | --- | --- |
| Deploys, 7d | Releases with `deployedAt` in the last 7 days | Releases created in the window |
| Success rate, 30d | Promoted divided by (Promoted + Rolled back + Failed) completed in the last 30 days | "N promoted of M" |
| Active canaries | Releases in `Canary` or `Progressing` | Their traffic percentages |
| Rollbacks, 30d | Rolled back in the last 30 days | How many of the finished releases failed health checks |
| Awaiting approval | Pending approvals without a decision this session | How many are High risk; links to the Approvals tab |
| Mean time to promote | Average hours from `createdAt` to `completedAt` over promoted releases | "Draft to 100% traffic" |

The tab strip shows a `CountPill` with the release count and, when anything is pending, an amber pill on Approvals.

### Releases tab

A `DataTable` of `Release`, newest first by deployed date (or created date when not deployed). Rows link to the record.

| Column | What it shows |
| --- | --- |
| Release | `rel-…` id |
| Agent | Agent chip |
| Version | Semver chip (`v2.4.1`) and environment badge |
| What changed | Up to two change chips (prompt `p-7 → p-8`, model before → after, `+tool` / `−tool`, `temperature 0.3 → 0.2`, `top_k 8 → 12`); `+N more` with a tooltip |
| Strategy | `Canary 5% → 25% → 100%`, `Blue-green`, `Shadow (mirrored traffic)`, `Direct` |
| Stage | `Draft`, `Pending approval`, `Canary`, `Progressing`, `Promoted`, `Rolled back`, `Failed` |
| Eval gate | `Passed` / `Failed` with `score / threshold`, or `Pending`; failed gates show the reason underneath (for example "1 regression on kb-draft-v4"); Draft releases without a run read "No gate". Links to `/agentops/evals?run=<id>`, which highlights the run. Header tooltip |
| Traffic | Bar with the step markers and the current share. Shows an empty placeholder for Draft, Pending approval and Failed |
| Health vs baseline | Error-rate delta in points and quality delta; either turns red past tolerance |
| Deployed by | Hidden by default |
| When | Deployed date, or created date |

Facets: Agent, Stage, Strategy, Environment. Search covers id, version, summary, stage, strategy and agent name. Strategy and Health headers carry tooltips. Toolbar: `New release`, disabled with a tooltip: releases are drafted from a passed eval run or from the Environments tab.

### Environments tab

A matrix with one row per deployed agent and columns Development, Staging, Production, Shadow. Each populated cell shows the version chip (linked to its release when one exists; production cells are highlighted green), the model, the prompt version and when it was last deployed. A small blue `↑N` badge marks a non-production environment N versions ahead of production. Empty cells show a blank placeholder, or "Not deployed" in the Production column.

The right-hand column shows one of: `Promote → prod` (staging is ahead of production), `In sync`, `Staging only` (no production deployment), or a link to the release that already tracks the staging version (seeded or drafted this session).

The promote dialog ("Promote staging to production") shows the production and staging versions and models side by side, then either the change chips of the release already tracking that staging version (with an `Open rel-…` button) or the prompt version diff and the eval gate the draft would carry (the agent's latest finished run on the staging prompt version, else its latest passed run, else none). The confirm button is `Draft canary`.

### Approvals tab

One card per release in `Pending approval` without a decision this session (`approvalsFrom()` in the store derives the cards, so releases drafted this session appear too). Each card shows:

- Release id (link), version chip, stage badge, agent, strategy, when approval was requested, and a risk badge (`Low`, `Moderate`, `High`, `Very High`).
- What: up to five change chips.
- Evidence, four tiles each with a pass, fail or not-applicable icon:
  - Eval gate: Passed / Failed with score against the threshold and the failure reason, Pending, or "No gate".
  - Guardrail coverage: percent of the agent's guardrail suite that exercises these changes; ok at 80% and above.
  - Experiment: `P(B > A)` significance when the release came from an experiment, ok at 95% and above; "Not derived from one" otherwise.
  - Cost estimate: percent change per day; ok at +10% and below.
- Approvers: "N of M approved", a segmented progress bar, the due date (amber when under 12 hours away; due is 2 days after the request), and each approver with role (`Agent owner`, `Platform lead`, `AI governance`) and status.
- Buttons: `Approve` (disabled until the eval gate has passed, with a tooltip quoting the gate reason), `Request changes`, and a reject button (`X`). Both of the latter open a dialog that requires a reason of at least 10 characters; the reason is posted to the release activity and stored as the audit `context.reason`.

Decided cards move to a "Decided this session" list below with the release's current stage. When the queue is empty the tab shows "Queue cleared".

### Release record (`/agentops/deployments/<id>`)

Header: `<agent> <version>`, the summary, stage and environment badges, `previous → version` chips, and a `Paused` marker when you have paused the rollout. Meta row: Agent, Strategy, Deployed by, Created. Overflow menu: Open agent, Open prompt version (when the release changes the prompt; links to the prompt record), Compare traces for this agent (`/agentops/traces?agent=<id>`), Audit history (`/agentops/audit?source=release&q=<rel-id>`), Export release notes (Markdown, real download).

Header actions depend on stage:

| Stage | Buttons |
| --- | --- |
| Pending approval, not yet fully approved | `Approve` (disabled until the eval gate has passed; tooltip gives the reason) |
| Draft or Pending approval, approved and gate passed | `Start rollout` |
| Canary or Progressing | `Promote` (disabled while paused), `Pause` / `Resume`, `Roll back` |
| Promoted | `Roll back` |
| Draft without a gate | none; the Guardrails & gates list links to the agent's eval runs |

Left column:

- Lifecycle tracker: Draft, Approved, Canary, Progressing, Promoted, with Rolled back and Failed as terminal states.
- Details: Strategy, Environment, Risk, Author, Approvers (each with role and `approved` / `pending` status), Eval run (links to the runs list with the run highlighted and to the run record; "Not run (Draft)" for gateless drafts), Prompt version (links to the prompt record, or "Unchanged"), Experiment link (or "Not derived from one"), Rollback target (links to the Environments tab filtered to the agent), Deployed and Completed timestamps.

Main column:

- A `StatGrid` of four cards: Traffic on new version (with "Next step N%" while live), Quality vs baseline (red ring below −0.5), Error rate vs baseline in points (red ring above +0.2, hint "Above tolerance" / "Within tolerance"), Cost delta per day in percent.
- Changes: a Field / Before / After table of every `ReleaseChange`. Model rows show model chips; tool rows show added tools in green and removed tools struck through in red; other values are shown as code.
- Rollout: two charts side by side (`CHART_HEIGHT.md`). Left: traffic share as a stepped area with quality of the new version and the baseline as lines. Right: error rate of the new version and the baseline. Below, for canary releases, the step pills (`5% → 25% → 100%`) with reached steps ticked. While the release is live the section header shows `Advance to N%` (tooltip when disabled), `Pause` / `Resume` and `Roll back`.
- Guardrails & gates: four rows with pass, fail or not-run icons. Eval gate (chip with score, threshold and reason, or a "Not run yet" note linking to the agent's eval runs); Guardrail coverage (ok at 80%+); Cost delta estimate (ok at +10% and below, with the dollar figure per day based on the agent's current spend); Approvals (all approvers signed off).
- Activity: the release timeline newest first (created, eval, approval, deploy, advance, promote, rollback, fail, note), with actor and relative time.

Every destructive or exposure-widening action (advance, pause, promote, roll back) goes through an `AlertDialog` that restates the current quality and error deltas. Roll back requires a reason of at least 10 characters; Promote takes an optional note. Both are posted to the activity and stored as the audit `context.reason`. Every confirmation toast carries an `Open audit log` action.

## What to check

### Every day

- **Active canaries card and the Releases tab filtered to Canary / Progressing.** A canary that has sat at 5% or 25% for more than a day is forgotten, not cautious. Open it; either advance it or roll it back.
- **Health vs baseline on live releases.** Error-rate delta above +0.2 points or quality delta below −0.5 is red. Red on a live release means roll back now and investigate later; the dialog text tells you where traffic will go.
- **Awaiting approval card and the Approvals tab, sorted by due.** Amber due times are under 12 hours. High-risk approvals (any model change) need three sign-offs including AI governance; chase them before the SLA lapses.
- **Approvals with a failed eval gate.** `Approve` is disabled on them. In the sample `agt-kb-curator` has a pending release (`rel-1033`) whose gate failed at a composite of 87, above the 85 threshold, because of "1 regression on kb-draft-v4"; the chip shows that reason. The right move is Request changes with a reason, not waiting.
- **Rollbacks, 30d** above 0: read each rolled-back release's Activity for the reason and confirm there is a follow-up release or a closed issue.

### Every week

- **Success rate, 30d.** Below roughly 90% means candidates are reaching production without enough pre-deploy evidence. Check whether failing releases had an eval gate at all ("No gate" in the Eval gate column means no run is attached; in the sample only the Draft releases `rel-1012` and `rel-1037` are gateless).
- **Mean time to promote.** Rising MTTP with a stable deploy count usually means approvals are the bottleneck; compare with the Approvals tab backlog.
- **Environments tab, `↑N` badges on staging.** Staging several versions ahead of production for weeks is untested drift. Either promote or discard.
- **Environments tab, "Staging only".** Agents with no production deployment but staging traffic should be either promoted or clearly marked as pilots in the Readiness Assessment.
- **Shadow releases** (Strategy facet). Shadow mirrors traffic to the new version without serving it. A shadow release older than its intended comparison window is wasted spend; promote to canary or close it.
- **Guardrail coverage** in Approvals and release records. Anything below 80% is flagged. In the sample `agt-hr-answers` has a pending release at 72%. Fix coverage on the Guardrails page before approving.

### Before a release or model change

- **Eval gate `Passed` with a score at or above 85** on the release record, and the run id resolves to a real run of the same agent (`features/agentops/deployments/deployments-data.test.ts` pins this for the seed). Follow the chip to the highlighted run and compare its prompt version and model with the release.
- **Risk matches the change.** Any model change is High risk and requires the agent owner, the platform lead and AI governance. Tool and retrieval changes are Moderate (owner plus platform lead). If a release that swaps a model shows Low, something is wrong with how it was drafted.
- **All approvers `approved`** in the Details panel. `Start rollout` only appears when the gate has passed and the record is approved.
- **Strategy is Canary for production** unless there is a written reason. Blue-green is a 0 → 100 switch with no partial exposure; Direct has no safety net at all. Direct is the default for staging in the sample data and should stay there.
- **Rollback target** is the version production currently serves. The Details panel shows it; the Environments tab confirms it.
- **Cost delta estimate** at or below +10% per day, or an explicit budget approval on the Costs & Budgets page. A model change that reads `−38.4%` is a saving; one that reads `+25%` with no budget note is a surprise invoice.
- **Experiment evidence** when the release came from an A/B test: `P(B > A)` at 95% or more. A release derived from an experiment at 80% is a hunch, not evidence.
- **After starting the canary:** watch the Rollout charts at each step. Quality of the new version should track or exceed the baseline line and error rate should not open a gap. Advance only when both hold for the whole step.

## Actions

| Action | Where | What it does in this template |
| --- | --- | --- |
| New release | Releases toolbar | Disabled with a tooltip. Releases are drafted from a passed eval run (`Promote to production` on the run record) or from the Environments tab |
| Approve | Record header; approval card | Marks every approver `approved` in the release store, appends an approval event to Activity, appends `release.approved` to the audit log, toasts (the record header toast carries an `Open audit log` action; the card toast is description only). The card moves to "Decided this session" |
| Request changes / Reject | Approval card | Dialog requiring a reason of 10+ characters. Reject returns the release to `Draft`; Request changes marks the signed-in approver. The reason is posted to Activity and stored as the audit `context.reason` on `release.rejected` / `release.changes_requested` |
| Start rollout | Record header | Sets stage to `Canary` (canary strategy) or `Progressing`, traffic to the first step, `deployedAt` to now, appends a deploy event and `release.deployed` |
| Advance to N% | Rollout section while live | Dialog restating the deltas, then moves traffic to the next step and appends `release.canary.advanced`; reaching 100% sets `Promoted`, `completedAt` and appends `release.promoted` |
| Pause / Resume | Record header and rollout section while live | Dialog, then toggles a local paused flag; disables Advance and Promote; appends a note event and `release.paused` / `release.resumed` |
| Promote | Record header while live | Dialog with an optional note, then traffic 100%, stage `Promoted`, `completedAt` now, `release.promoted` |
| Roll back | Record header and rollout section | Dialog that restates the deltas and requires a reason, then traffic 0, stage `Rolled back`, `completedAt` now, a rollback activity event carrying the reason, and `release.rolled_back` with `context.reason` |
| Export release notes | Record overflow | Downloads `<rel-id>-release-notes.md` (summary, gate, coverage, cost, changes table, activity). Real file download |
| Promote → prod / Draft canary | Environments tab | Dialog, then drafts a real release in the release store (`draftReleaseFromStaging`): next `rel-` id, Canary 5% then 25% then 100%, `Pending approval` when a gate run exists, otherwise `Draft` without a gate; appends `release.created`. The toast offers `Open release` and the row links to it from then on |
| Enforce (eval gate) | Lives on the Evals page, not here | |

Activity events you create are stamped with the signed-in sample user (`currentUser`, Kevin Dargas) and the fixed clock. Releases live in the module-scoped `releaseStore`, decisions in `decisionStore`; both reset on reload. Every transition above appends a `release.*` event to the client audit log, so the Audit Log page and the `Open audit log` toast action show them in the same session.

## Reading the data

### Stage

| Stage | Meaning | Traffic shown |
| --- | --- | --- |
| Draft | Created, eval gate pending, no approvals | not shown |
| Pending approval | Gate run, waiting for sign-offs | not shown |
| Canary | Serving the first canary step | current % (pulsing badge) |
| Progressing | Past the first step, or a blue-green cut-over in progress | current % (pulsing badge) |
| Promoted | 100% on the new version | 100% (green bar) |
| Rolled back | Traffic returned to `rollbackTarget` | 0% (amber bar) |
| Failed | Health check failed before promotion | not shown |

### Strategy and steps

| Strategy | Steps | Notes |
| --- | --- | --- |
| Canary | 5, 25, 100 | Default for production in the sample |
| Blue-green | 0, 100 | Full cut-over after warm-up |
| Shadow | 0 | Mirrored traffic, never served |
| Direct | 100 | Immediate; used for staging |

### Environment badges

`production` green, `staging` blue, `development` grey, `shadow` neutral.

### Risk

Derived from the change kinds by `riskFor()`: any `model` change is `High`; any `tools` or `retrieval` change is `Moderate`; prompt or params only is `Low`. `Very High` exists in the `ChangeRisk` type but is not generated.

### Approvers

`approversFor()`: the agent owner always; plus `u-004` as Platform lead when risk is not Low; plus `u-009` (Hannah Müller) as AI governance when risk is High or Very High. Statuses: `approved`, `pending`, `rejected`, `changes requested`.

### Eval gate

`passed`, `failed` or `pending`, with `score` (composite on the golden set), `threshold` (always 85, `GATE_THRESHOLD`) and an optional `reason` for failures the composite does not explain (regressions on the golden set, pass rate below 80%). `EvalGateChip` renders score, threshold and reason; the releases table, approval cards and record link to `/agentops/evals?run=<runId>`, which highlights the run. Draft releases may have no gate at all (`rel-1012`, `rel-1037` in the sample); the chip then reads "No gate".

### Health deltas

`errorRateDelta` is in percentage points; red above +0.2. `qualityDelta` is in composite points; red below −0.5. Both are blank until a rollout has produced points. The same thresholds drive the red rings on the record's stat cards and the "Above tolerance" hint.

### Other thresholds

| Check | Pass condition | Where |
| --- | --- | --- |
| Guardrail coverage | 80% and above | approval cards, record gates list |
| Cost delta | +10% per day and below | approval cards, record gates list |
| Experiment significance | 0.95 and above | approval cards |
| Approval due | amber under 12 hours | approval cards |

### Change chips

Colour by kind: prompt (blue), model (purple), tools (teal, `+` added in green or `−` removed in red), params (grey), retrieval (orange).

## How the data gets here

`lib/data/deployments.ts`, seeded with `createRng(7901)`. Releases are generated backwards from each agent in `lib/data/agentops.ts`, so the latest Promoted production release of every agent is exactly the version, model and prompt the agent currently serves, and `rollbackTarget` on pending work is the live version.

- `Release`: id, agentId, version, previousVersion, environment, strategy, steps, stage, summary, `changes: ReleaseChange[]` (kind, field, before, after), optional `evalGate` (status, score, threshold, runId, optional reason), traffic, `health` (errorRateDelta, qualityDelta), risk, guardrailCoverage, costDeltaPct, deployedById, `approvers`, optional experimentId, createdAt, deployedAt, completedAt, rollbackTarget, `rollout: RolloutPoint[]` (at, traffic, quality, baselineQuality, errorRate, baselineErrorRate), `activity: ReleaseEvent[]`.
- `EnvironmentState`: agentId, environment, version, modelId, promptVersion, lastDeployedAt, optional releaseId. One per agent per environment it is deployed in.
- `ReleaseApproval`: `apr-<n>` per release in `Pending approval`, with risk, requestedAt, due (+2 days), evidence (evalGate, experimentSignificance, guardrailCoverage, costDeltaPct) and approvers. Derived, not stored separately.
- Exports: `releases` (sorted newest first), `environments`, `releaseApprovals`, `getRelease`, `getEnvironment`, `compareVersions`, `parseVersion`, `formatVersion`, `timeToPromoteHours`, `releaseStages`, `releaseStrategies`, `releaseEnvironments`.
- Named exceptions in the sample: `agt-kb-curator` has a pending release (`rel-1033`) whose gate failed at 87 with reason "1 regression on kb-draft-v4"; `agt-hr-answers` has guardrail coverage 72; `agt-ops-analyst` has a release derived from `exp-ops-retrieval`; one model-swap release carries `costDeltaPct` −38.4; `rel-1012` and `rel-1037` are Drafts without an eval gate.
- Tests: `features/agentops/deployments/deployments-data.test.ts` pins that every gate resolves to a run of the same agent with the gate score equal to the run composite, that only Drafts are gateless, that prompt changes resolve via `releasePromptVersion`, and that approvals derive from pending releases.
- The audit log turns every `ReleaseEvent` into a `release.*` audit event and model or params changes on deployed releases into `agent-config` events (`lib/data/audit.ts`).

To wire a backend: return the same types from your release service. Every component reads `releaseStore` (`createListStore` in `lib/store.ts`); `ReleaseRecord` takes the id plus the server-rendered seed release and resolves the current row from the store, so replace the store `patch` and `add` calls in `release-record.tsx`, `release-approvals.tsx` and `store.ts` (`draftReleaseFromRun`, `draftReleaseFromStaging`) with mutations and refetch. Rollout points should stream from your metrics store at the cadence your canary controller samples. Replace `recordAudit()` with your audit append endpoint.

## Related pages

- [Evals & Datasets](evals-and-datasets.md): the eval gate score and threshold come from the agent's golden-set run; per-agent gate rules and the Enforce switch live there; `Promote to production` on a run drafts a release here.
- [Guardrails](guardrails.md): guardrail coverage per release is the share of the agent's suite that exercises the change; coverage gaps are fixed there.
- [Audit Log](audit-log.md): `release.created`, `release.eval_gate.passed`, `release.approved`, `release.deployed`, `release.canary.advanced`, `release.promoted`, `release.rolled_back`, `release.failed`, `release.rejected`, `release.changes_requested`, `release.paused`, `release.resumed` and `agent.config.params_changed` events; the record's Audit history link and every toast open the log filtered to the release.
- [Costs & Budgets](costs-and-budgets.md): the cost delta estimate per release should be checked against the agent's budget.
- [Schedules & Triggers](schedules-and-triggers.md): freeze windows constrain when a rollout may start.
- [Readiness Assessment](readiness-assessment.md): the governance domain expects staged rollouts, approvals and rollback targets.
- Agents (`/agentops/agents/<id>`): the live version, model and prompt the environments matrix reports.
- Experiments (`/agentops/experiments?open=<exp-id>`): the source of experiment-derived releases and their significance.
- Traces (`/agentops/traces?agent=<id>`): compare runs across versions during a canary.
