# Guardrails

Guardrails are the rules that bound what an agent may read, say and do. Each policy is a versioned YAML document with a readable configuration next to it, scoped to the whole fleet or to a list of agents, and enforced by one of five engines (regex, classifier, LLM judge, schema, policy engine). Every time a policy fires it produces a violation that links back to the trace it fired on, so the safety story and the observability story share one record.

The page is for the platform team and the people who own individual agents. Platform engineers use it to keep the fleet covered in all four categories and to watch false-positive and bypass rates. Agent owners use it to tune thresholds and scope for their own agents, and reviewers use the Violations tab to decide whether a trigger was a true or false positive.

## Where to find it

- Sidebar: Govern > Guardrails. Keyboard shortcut `G` then `G`. The page header reads its eyebrow ("Govern"), icon and title from `config/nav.ts` via `<PageHeader nav="/agentops/guardrails" />`, so the sidebar, breadcrumb and h1 all say "Guardrails".
- Route: `/agentops/guardrails`.
- Query parameters:
  - `?tab=policies|violations|coverage|test` selects the tab. Anything else falls back to `policies`. Switching tabs writes the parameter back with `history.replaceState`, so the URL round-trips.
  - `?policy=grd-<id>` opens the policy sheet for that policy. Unknown ids are ignored. Opening and closing the sheet rewrites the parameter the same way.
  - `?tab=violations&byPolicy=grd-<id>` opens the Violations tab with the Policy facet pre-selected. The policy sheet's `Violations` button and the audit log's verdict events link here.
- Files: route `app/(app)/agentops/guardrails/page.tsx`, UI `features/agentops/guardrails/*`, data `lib/data/guardrails.ts`.

## What is on the page

### Stat cards

Five cards in a `StatGrid`, rendered by the client `GuardrailsView` from the same two module stores the tables use (`policyStore`, `violationStore` in `features/agentops/guardrails/store.ts`), so disabling a policy or deciding a verdict moves the numbers immediately:

| Card | Value | Hint |
| --- | --- | --- |
| Active policies | Count of policies with status `Active` | How many are disabled or draft |
| Blocked, 24h | Sum of `triggers24h` across Active policies in `Block` mode | |
| Flagged, 24h | Sum of `triggers24h` across Active policies in `Flag` mode | |
| False-positive rate | Dismissed verdicts divided by all decided verdicts (Verified + Dismissed) in the violations log; blank until one verdict exists | How many reviewer verdicts the rate is based on and how many are pending; amber at 15%, red at 30%; links to the Violations tab |
| Agents without output guardrails | Agents whose Output category count is 0 | Names the agents; turns amber when above 0; links to `?tab=coverage` |

### Policies tab

A `DataTable` of every policy, one row per `Guardrail`, sorted by Triggers 24h descending. Clicking a row opens the policy sheet.

| Column | What it shows |
| --- | --- |
| Policy | Name and description. Rows whose status is not `Active` are dimmed. |
| Category | `Input`, `Output`, `Action` or `Data` badge. |
| Mode | `Block`, `Flag`, `Redact` or `Require approval` badge. |
| Scope | "All agents" or "N agents". Hover for the list of agent names. Sorts fleet-wide scope last. |
| Engine | Regex, Classifier, LLM judge, Schema or Policy engine. Classifier and LLM-judge rows also show the backing model. |
| Triggers, 24h | A 14-day sparkline and the 24h count. Sparkline is red for `Block` mode, blue otherwise, grey when the policy is not Active. |
| False pos. | Dismissed divided by decided verdicts on this policy's violations, the same definition as the fleet card. Blank until a reviewer has decided at least one of its violations. |
| Fail mode | `Fail closed` (green) or `Fail open` (amber). |
| p95 | Evaluation latency added to the turn. |
| Bypass | Red-team bypass rate. Blank unless the policy has a `lastRedTeamRunId`. |
| Status | `Active`, `Disabled`, `Draft`. |
| Owner | User chip. Hidden by default; enable from the column menu. |

Facets: Category, Mode, Status, Fail mode. Search covers name, description, category, mode, engine, model id, fail mode and languages. Jargon headers (Mode, Triggers, False pos., Fail mode, p95, Bypass) carry a tooltip. The `New policy` button sits in the page header.

### Violations tab

A `DataTable` of `GuardrailViolation` records (84 in the sample, spread over the last 72 hours), newest first, with row selection.

| Column | What it shows |
| --- | --- |
| Time | Date and time of the trigger. |
| Agent | Agent chip. |
| Policy | Policy name. Click to open the policy sheet. |
| Category | Hidden by default. |
| Action | What the policy did: `Blocked`, `Flagged`, `Redacted`, `Approval requested`. |
| Severity | `Critical`, `Warning`, `Info`. Sorts Critical first. |
| Snippet | The matched text, already redacted, in monospace. |
| Trace | Link to `/agentops/traces/<tr_id>`. |
| Verdict | `Verified`, `Dismissed` or `Pending`, plus the reviewer's avatar once decided. The badge is a menu: pick True positive, False positive or Pending for that row. |

Facets: Policy, Action, Severity, Verdict (labelled True positive / False positive / Pending), Category, Agent. Search covers policy name, snippet, trace id, action and severity.

Bulk actions on selected rows: `Mark true positive`, `Mark false positive` and `Open review queue` (a plain link to `/agentops/reviews`; it does not create review items). Every verdict change shows a toast with an `Undo` action for eight seconds and appends a `guardrail.violation.*` event to the audit log.

### Coverage tab

An agent x category matrix. Rows are every deployed agent, sorted worst coverage first; columns are the four categories. Each cell is a button showing how many Active policies of that category include the agent in scope:

| Cell | Meaning |
| --- | --- |
| Amber with warning icon, `0` | Gap: no active policy of that category covers the agent |
| Neutral, `1` or `2` | Covered, shallow |
| Green, `3+` | Covered with depth |

The right-hand column is a coverage score bar (0 to 100; green at 85 and above, amber from 70, red below). Above the table: average coverage score across agents, and the number of gaps. Disabled and Draft policies do not count.

Clicking a cell shows a toast listing the matching policies (with an `Open` action when there is exactly one), or a warning toast telling you which policy to add when the cell is a gap.

### Test tab

An offline policy tester. Left side: four sample payloads (customer message with PII, prompt injection attempt, credential in model output, destructive action request), a text area with a rough token estimate (characters divided by 4), and an `Evaluate as` select with "All agents (fleet policies)" or a single agent. `Run guardrails` evaluates the text; `Clear` resets.

Right side, after a run:

- A banner: "Passed every guardrail" (green), "Request would be blocked" (red, when any tripped policy is in `Block` mode) or "N policies tripped" (amber). Below it: how many policies were checked, tripped, and not evaluable offline.
- One card per tripped policy: category and action badges, policy name, an explanation of what the engine would do, the matched fragments (redacted), engine and mode, and an `Open policy` link.
- A collapsible `Passed` list.
- A collapsible `Not evaluable offline` list. Spend, rate-limit, retention, region and schema checks need the live run context, so they are listed but not evaluated.

If you edit the text or change the agent after a run, a `stale` badge appears until you run again.

### Policy sheet

Opens from any tab via `?policy=`. Sections, top to bottom:

- Header: category, mode and status badges, policy id, name, description, owner, last updated, scope.
- Action row: `Enable` / `Disable` (confirmation dialog), `Duplicate`, `Export`, `Violations` (links to the Violations tab filtered to this policy; the traces list does not accept a policy filter).
- Three metric tiles: Triggers 24h, False-positive rate (with the verdict count it is based on), Engine.
- Effectiveness: fail mode badge, p95 evaluation latency, red-team bypass rate, false-positive rate. Inline warnings appear for fail-open policies and for bypass above 5%. Below: the last red-team eval run (link to `/agentops/evals/<ev-id>`, dataset, case count, when) or "Not an attack surface", and language coverage (ISO codes, or "Language-agnostic").
- Configuration: the readable key/value config, then the YAML source (`<id>.yaml`) with a copy button.
- Threshold (only for policies with a tunable threshold): slider with the config key, current and previous value, min and max, and a `Save` button that enables when the value changes.
- Scope: a checkbox per deployed agent with environment label, and a `Save scope` button. Selecting every agent saves as fleet-wide. Zero agents is rejected.
- Trigger history: daily triggers for the last 14 days.
- Recent violations: the five most recent for this policy with agent, action, severity, snippet, trace link and verdict.
- Versions: every version with author, date and summary; the newest is marked `current`; older versions have a `Rollback` button that asks for confirmation. Saving a threshold or scope and rolling back each append a new version authored by the signed-in user.
- Footer: a `Close` button (`SheetFooterActions`).

The sheet uses the shared sheet frame (`sheetWidths.editor`, `SheetBody`), and its label/value rows collapse to one column on phones.

## What to check

### Every day

- **Agents without output guardrails** card. Anything above 0 means an agent can emit text with no output policy in front of it. Open the Coverage tab, find the amber Output cell, and add or re-scope an Output policy. In the sample data `agt-ops-analyst` has this gap.
- **Violations tab, Severity = Critical, Verdict = Pending.** Critical is reserved for secret leakage, region pinning and tool allowlist breaches. Each one should be decided the same day: open the trace, then mark false positive or send to review.
- **Violations tab, Verdict = Pending, sorted by time.** Pending verdicts starve the false-positive rate of data. Work the backlog down; the fleet FP card is only as good as the number in its hint.
- **Policies tab, Triggers 24h sparkline.** A spike relative to the 14-day line on a `Block` policy usually means either an attack or a regression in an upstream prompt. Open the sheet, read the Recent violations snippets, and follow the trace links.
- **Disabled policies.** Filter Status = Disabled. Confirm each one is intentionally off and has an owner who knows. The sample has `Competitor mention` disabled.

### Every week

- **False-positive rate per policy.** The column turns amber at 15% and red at 30%. Above 15%, lower the threshold or narrow the scope; above 30%, consider moving the policy from `Block` to `Flag` until it is retuned. Reviewers dismissing triggers is the only thing that lowers this number.
- **p95 evaluation latency.** Amber at 1000 ms. A guardrail that adds a second to every turn is a user-facing latency regression. Check whether an LLM-judge engine can be replaced by a classifier or regex for the common case.
- **Fail mode.** Filter Fail mode = Fail open. For anything in the Data or Action category, or anything that protects secrets or PII, fail open means an engine outage disables protection silently. Flip to fail closed unless availability genuinely matters more.
- **Coverage score.** Any agent below 70 is red. Aim for every production agent at 85 or above, which in practice means every category covered and at least three policies in the categories that matter for that agent.
- **Versions without a recent change.** A policy with three versions all dated months ago, a rising trigger count and a rising FP rate is being left to drift.

### Before a release or model change

- **Red-team bypass rate.** Any policy with a bypass above 5% shows red in the Bypass column and a red warning in the sheet. Do not promote a model change behind a policy that is already leaking. Re-run the red-team dataset against the candidate (Evals page) and compare.
- **Last red-team run age.** The Effectiveness section shows when the bypass rate was measured. If the model, prompt or tools changed since, the number is stale.
- **Language coverage.** If the release adds a locale, every classifier and LLM-judge policy in scope should list it; regex and policy-engine policies are language-agnostic.
- **Run the Test tab** against the candidate agent with the four presets and with real examples from the release's eval failures. Confirm the injection and secrets presets are blocked or redacted, and that the destructive-action preset requests approval.
- **Coverage for the agent being released.** The deployments page reports guardrail coverage per release and flags it below 80%; the Coverage tab here is where you fix it.

## Actions

| Action | Where | What it does in this template |
| --- | --- | --- |
| New policy | Page header | Dialog: pick an existing policy to start from. Creates `<id>-copy` (or `-copy-2`, ...) as a `Draft` with zeroed triggers and a `v1.0` version authored by the signed-in user, appends `guardrail.policy.created`, navigates to `?policy=<copy>`. There is no YAML editor. |
| Open policy | Any row, violation policy name, coverage cell toast, tester card | Sets `?policy=` and opens the sheet. |
| Enable / Disable | Sheet | Confirmation dialog, then updates the policy status in the shared store and toasts. Existing violations are kept. Coverage and stat cards recompute. Appends `guardrail.policy.enabled` or `guardrail.policy.disabled`. |
| Duplicate | Sheet | Same as New policy but from the open policy; refuses if the copy already exists. |
| Export | Sheet | Downloads the YAML source as `<id>.yaml`. Real file download. |
| Violations | Sheet | Links to `?tab=violations&byPolicy=<id>`. |
| Save threshold | Sheet | Patches `threshold.value` and the matching `config` key, appends a policy version and a `guardrail.threshold.changed` event with before and after, toasts. |
| Save scope | Sheet | Patches `scope` (all agents collapses to `"all"`), appends a version and `guardrail.policy.updated`, toasts. |
| Rollback | Sheet, older version rows | Confirmation dialog, then appends a new version "Rolled back to vX" and a `guardrail.policy.rolled_back` event. |
| Verdict menu | Violations rows | Sets `Verified`, `Dismissed` or `Pending` (reviewer is the signed-in user; Pending clears it), appends `guardrail.violation.verified`, `.dismissed` or `.reopened`, toasts with `Undo`. |
| Mark true positive / Mark false positive | Violations bulk actions | Same as the menu for every selected row. |
| Open review queue | Violations bulk action | Link to `/agentops/reviews`. Does not create review items and does not claim to. |
| Run guardrails / Clear | Test tab | Runs `evaluateGuardrails()` locally. No network. |

All state changes are lost on reload. Every mutation listed above appends an `AuditEvent` to the client audit store (`features/agentops/audit/audit-store.ts`), hash-chained onto the seed, so the Audit Log page shows it in the same session.

## Reading the data

### Categories

| Category | Hint in the UI | What it bounds |
| --- | --- | --- |
| Input | What the agent may read | User messages, attachments, injected content |
| Output | What the agent may say | Draft answers before they reach the user |
| Action | What the agent may do | Tool calls, spend, loop and rate limits, human-in-the-loop |
| Data | Where data may live and for how long | Retention, region, training opt-out |

### Modes and the action they produce

| Mode | Violation action | Effect |
| --- | --- | --- |
| Block | Blocked | The turn is refused |
| Flag | Flagged | The turn continues; the trace is routed to review |
| Redact | Redacted | The match is replaced before the model call or the user sees it |
| Require approval | Approval requested | The run pauses until a human approves |

### Fail mode

`fail_closed`: if the engine errors or times out the turn is rejected. `fail_open`: the turn passes unguarded. Fail open is shown amber everywhere and gets an inline warning in the sheet.

### Status

`Active` policies evaluate and count toward coverage. `Disabled` and `Draft` do neither. Draft policies are also excluded when violations are sampled.

### Severity of a violation

Set by `severityFor()`: `Critical` for `grd-secret-leakage`, `grd-region-pinning` and `grd-tool-allowlist`; `Warning` for any `Block` or `Require approval` policy and for prompt injection; `Info` otherwise.

### Verdict

`Pending` has no reviewer. `Verified` is a true positive. `Dismissed` is a false positive and is what the FP rate counts. In the sample 45 of 84 violations are decided, 16 of them dismissed, so the fleet card reads 36%.

### Thresholds encoded in the code

| Metric | Amber | Red | Where |
| --- | --- | --- | --- |
| False-positive rate | 15% | 30% | fleet card, policies table, sheet tiles (`fpThresholds` in `store.ts`) |
| p95 evaluation latency | 1000 ms | | policies table, sheet |
| Red-team bypass rate | | above 5% (`bypassAlertThreshold`) | policies table, sheet |
| Coverage score | below 85 | below 70 | coverage matrix score bar |
| Coverage cell | 0 policies (gap) | | coverage matrix |

Coverage score: 70 points for the share of categories with at least one Active policy, plus 30 points for depth, where each category contributes `min(count, 3) / 3`.

### False-positive rate, one definition

The card, the policies column and the sheet tiles all call `falsePositiveRate(violations, policyId?)`, defined in `lib/data/guardrails.ts` and re-exported by `features/agentops/guardrails/store.ts`: dismissed divided by decided verdicts in the violations log. The seeded `Guardrail.falsePositiveRate` field is kept on the type for backends that supply it but is not rendered, so the three surfaces can no longer disagree. Policies whose violations have no decided verdicts show a blank.

## How the data gets here

Everything comes from `lib/data/guardrails.ts`, built with a seeded PRNG (`createRng(7501)` for policies, `7502` for violations) so server and client render identically.

- `Guardrail`: id, name, description, category, mode, scope (`"all"` or agent ids), engine, optional `modelId`, optional `threshold` (key, label, value, min, max, step, unit), `config` key/values, `policy` YAML, `triggers24h`, 14-entry `history`, `falsePositiveRate` (0 to 1), `failMode`, `p95Ms`, `bypassRate` (0 to 1), optional `lastRedTeamRunId` (`ev-…`), `languages`, status, owner, updated, `versions`.
- `GuardrailViolation`: id (`vio-0001`…), time, agentId, policyId, category, action, severity, redacted snippet, traceId (`tr_…`, always a real trace from `lib/data/agentops.ts`), verdict, optional reviewerId.
- `GuardrailCoverage` and `GuardrailEvaluation` are derived shapes for the matrix and the tester.
- Exports: `guardrails` (20 policies: 5 Input, 6 Output, 6 Action, 3 Data; one Disabled, one Draft), `guardrailViolations` (84), `getGuardrail`, `guardrailAppliesTo`, `guardrailsForAgent`, `guardrailCoverage`, `evaluateGuardrails`, `locallyEvaluable` (the 10 policy ids the tester can run), `guardrailPresets`, `guardrailStats`, `modeToAction`, `guardrailCategories`.
- Tests: `features/agentops/guardrails/guardrails.test.ts` pins 14 to 20 policies, 60 to 100 violations that resolve to real traces, agents and policies, 14-day histories, three versions per policy, and the `agt-ops-analyst` Output gap.
- The audit log derives `guardrail.policy.created`, `guardrail.policy.updated`, `guardrail.threshold.changed`, `guardrail.policy.disabled` and `guardrail.violation.escalated` events from these policies (`lib/data/audit.ts`).

To wire a backend: replace the module with API clients returning the same types. `policyStore` and `violationStore` (`createListStore` in `lib/store.ts`) are module-scoped client lists seeded from the module; swap their `patch`, `add` and `set` calls for mutations and refetch. `evaluateGuardrails()` is a local approximation using regex and keyword lists; a real tester should call the enforcement service in dry-run mode. The stat cards read the same stores as the tables, so they stay correct once the stores are fed by the API. Replace `recordAudit()` with your audit append endpoint.

## Related pages

- [Evals & Datasets](evals-and-datasets.md): red-team datasets (`red-team-injections-v2`, `pii-leak-probes-v1`) produce the bypass rates shown here, and the PII gate rule depends on them.
- [Deployments](deployments.md): each release reports guardrail coverage and flags it below 80%.
- [Audit Log](audit-log.md): policy creation, updates, threshold changes, enables, disables, rollbacks, escalated violations and reviewer verdicts appear as `guardrail.*` events; the ones you cause in a session are appended live.
- [Readiness Assessment](readiness-assessment.md): the safety domain controls map to the coverage this page provides.
- Traces (`/agentops/traces/<id>`): every violation links to the run it fired on.
- Review Queue (`/agentops/reviews`): flagged turns and bulk "Open review" land here.
- Tools & MCP (`/agentops/tools`): the tool allowlist and destructive-action policies reference tool risk levels defined there.
