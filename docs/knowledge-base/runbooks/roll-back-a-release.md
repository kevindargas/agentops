# Runbook: roll back a release

## When to use

A release in Canary or Progressing shows quality below baseline or error rate above baseline on the rollout chart, an enforced gate is now failing, a guardrail is being bypassed, or a Promoted release is found to be the cause of a drift signal or incident.

## Steps

1. Open Deployments (`/agentops/deployments`) and the release (`/agentops/deployments/[id]`).
2. Stop the bleeding first. If the release is Canary or Progressing, press Pause in the record header so traffic stops stepping up (a confirmation dialog follows). If users are being harmed right now and the agent has write tools, consider "Writes disabled" on Fleet Overview or Pause agent on the agent record while you work.
3. Confirm the target. The record's "Rollback target" field names the version to return to and links to the Environments tab filtered to the agent; confirm that version is still what production ran before this release (`previousVersion`).
4. Check that the rollback target does not reintroduce a known problem: open the prompt version (Details, "Prompt version") and model behind it, and the eval run that passed it ("Eval run" links to the runs list with the run highlighted and to the run record).
5. Trigger the rollback from the release record. The dialog restates the quality and error deltas and requires a reason of at least 10 characters. The stage becomes Rolled back, traffic returns to the target, a `rollback` event carrying your reason is appended to the release activity, and a `release.rolled_back` audit event with `context.reason` is appended to the log.
6. Verify on Traces: filter by the agent and confirm new traces carry the target `version` and `lineage.promptVersion`. Verify on the rollout chart that error rate and quality have returned to baseline.
7. Resolve or acknowledge the drift signal or incident that prompted the rollback, and reference the release id.
8. Open the Audit Log and confirm the `release.rolled_back` event exists: use the toast's `Open audit log` action or the record's "Audit history" overflow item, both of which land on `/agentops/audit?source=release&q=<rel-id>`. Seeded rollbacks are on legal hold by default; do not try to remove them.
9. Afterwards, write down why the gate did not catch it: missing dataset cases, missing guardrail category, too few canary steps. Add the cases to the golden dataset so the next gate catches it.

## What to record

- Rollback reason typed into the dialog (becomes the activity message and `context.reason` on the audit event).
- The incident or drift signal id.
- The follow-up: dataset cases added, guardrail added, or steps changed.

## Who to notify

- Agent owner and release author (`deployedById`) immediately. The template does not send notifications; both are listed in the record's Details panel.
- Approvers on the release, since their approval evidence was insufficient.
- Service desk lead if end users saw bad answers; they may need a knowledge article or a comms note.
- Platform owner for any rollback of a High or Very High risk release.
