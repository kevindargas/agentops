# Deployment strategies

A release in AgentOps is a change to an agent's configuration (prompt, model, tools, params, retrieval) moved through environments with a strategy that controls how much traffic sees the new version and when. Types are in `lib/data/deployments.ts`.

## Release lifecycle

| Stage | Meaning | Who moves it |
| --- | --- | --- |
| Draft | Change list assembled, eval gate not yet evaluated or not yet passed | Author |
| Pending approval | Gate passed, approvers assigned, waiting for sign-off | Approvers |
| Canary | A first traffic step is live (for Canary and Blue-green) | Operator advances or pauses |
| Progressing | Traffic is stepping up through `steps` | Operator or automation |
| Promoted | 100 percent traffic, `completedAt` set | Operator |
| Rolled back | Traffic returned to `rollbackTarget` | Operator |
| Failed | Health deltas breached and the release was stopped | Automation or operator |

The release record logs each move as a `ReleaseEvent` (created, eval, approval, deploy, advance, promote, rollback, fail, note) and the audit log mirrors it under source `release`. In the template, moves you make append to the client audit store and show on the Audit Log as "This session". Experiments that justify a release need `P(B > A)` at or above 0.95 (`SIGNIFICANCE_THRESHOLD`).

## Strategies

### Canary

Traffic to the new version steps through `steps`, 5, 25, 100 in every sample canary. At each step the rollout chart plots `quality` and `errorRate` for the new version against `baselineQuality` and `baselineErrorRate`. Advance when the new line is at or above baseline quality and at or below baseline error rate for long enough to be meaningful at that traffic share. Pause (the button toggles between Pause and Resume) when either moves the wrong way. Best default for production prompt and params changes.

### Blue-green

Two full environments. Traffic switches from blue (current) to green (new) in one step and can switch back in one step. There is no partial exposure, so quality problems hit every user, but rollback is instant and has no mixed-version period. Use it for model swaps where mixed versions would confuse evaluation, or when the change cannot be served alongside the old version (a new tool schema, a new index).

### Shadow

The new version receives a mirror of live traffic but its answers are not served. You get real-input evaluation with zero user exposure. Shadow runs produce traces in the `shadow` environment and feed Recommendations ("shadow evals show..."). Use it before a Canary for model changes, or for anything that touches regulated data where the first user exposure must already be defended.

### Direct

Replace the running version with no steps. Acceptable for development and staging; in production only for a rollback or an emergency guardrail change that has already been tested. Direct releases still need approvals when risk is High or Very High.

## What a release carries

- `changes`: each item has a kind (prompt, model, tools, params, retrieval), a field, before and after. The record renders a before/after diff.
- `evalGate`: status, score, threshold (85, `GATE_THRESHOLD`), run id and a `reason` when failed, at the time of the release. Draft releases have none yet.
- `health`: current `errorRateDelta` and `qualityDelta` versus baseline during rollout.
- `risk`: Low, Moderate, High, Very High, which decides who must approve.
- `guardrailCoverage`: share of the agent's guardrail suite covering this change.
- `costDeltaPct`: estimated change in daily cost.
- `approvers`: role, status (approved, pending, rejected, changes requested), time.
- `rollbackTarget`: the version to return to.
- `experimentId`: the experiment that justified the change, when there is one.

## Environments

The environments matrix lists, per agent and environment (production, staging, development, shadow), the version, model id, prompt version, last deployment time and the release that put it there. Before promoting, compare the production row with the release's `previousVersion` to be sure you are rolling forward from where you think you are.

## Freeze windows

Schedules & Triggers maintains `FreezeWindow` records with a scope such as "No production deploys". `freezeAt(iso)` returns the active window for a timestamp. Check the calendar before scheduling a Canary that would span a freeze; the rollout cannot be advanced inside one.

## Rollback

Every strategy has a rollback. Canary and Progressing releases return traffic to `rollbackTarget`; Blue-green switches back; Shadow needs none; Direct redeploys the previous version. Roll back opens a confirmation dialog and needs a reason of at least ten characters, which becomes the audit reason. The step-by-step procedure is in [roll back a release](../runbooks/roll-back-a-release.md). Rollbacks are legal-hold events in the audit log.
