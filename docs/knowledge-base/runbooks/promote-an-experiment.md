# Runbook: promote an experiment

## When to use

An experiment on Experiments (`/agentops/experiments`) is Running or Completed, variant B looks better on its primary metric, and you want B to become the deployed configuration.

## Steps

1. Open the experiment. Check the basics before reading the result: both variants have a meaningful number of requests, the split did what you intended, the primary metric (quality, cost or latency) is the one you care about, and `ends` has passed or enough days are on the daily chart.
2. Check significance. `significance` is the probability that B beats A on the primary metric. Treat 0.95 as the floor for promotion; below that, extend the experiment rather than promote.
3. Check the secondary metrics on the variants table. A win on cost with a loss on quality or error rate is not a win. Compare `quality`, `p95Ms`, `costPer1k`, `thumbsUp` and `errorRate` side by side.
4. Check the eval gate for the agent on Evals & Datasets. If B is a prompt or params change, run the eval against B's prompt version first; promotion must not bypass the gate.
5. Press Promote B (or Promote winner on a Completed experiment). A confirmation restates the significance, the primary-metric delta and the request count and reminds you about the eval gate; confirming sets the status to Promoted. In the sample this is local state with a toast; in a wired deployment it should open a release.
6. Finish the promotion where the configuration lives. The sheet footer shows a "Finish on ..." link for the experiment's kind:
   - prompt experiment: on Prompts, label B's version `production` and the old one `archived` or `staging`.
   - model experiment: on Deployments, create a release with change kind `model`, strategy Canary or Blue-green, and link `experimentId`.
   - retrieval experiment: on Knowledge & Memory, apply the retrieval settings to the knowledge base.
   - tooling experiment: on Tools & MCP, update the agent's tool allowlist and permission matrix.
7. If the experiment started from a recommendation, the sheet shows a "Tests recommendation" chip; follow it and press Apply.
8. Watch Traces and Drift & Quality for the agent for the rest of the day; a promoted change resets the release baseline.

## What to record

- The promotion itself (writes an audit event under the owning source: `prompt`, `release`, or `agent-config`).
- In the release or version change note: the experiment id, the significance and the primary metric delta.

## Who to notify

- Agent owner and the experiment `ownerId` if different.
- Finance or budget owner when the promoted variant changes `costPer1k` materially.
- Reviewers, so the Review Queue rubric is read against the new behaviour.
