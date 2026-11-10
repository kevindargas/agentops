# Runbook: onboard a new agent

## When to use

A team has an agent ready for staging or production and you want it operated like the rest of the fleet: visible on Fleet Overview, traced, reviewed, gated, budgeted and governed.

## Steps

The "Register agent" button on Fleet Overview and Agents opens a registration sheet (name, team, model id, framework, description) that adds a staging agent with zero traffic to the Agents table for the session. The real work is the data and configuration below. Do the steps in this order so each page has what it needs.

1. **Identity and limits.** Create the `DeployedAgent`: id with the `agt-` prefix, name, description, team, `ownerId`, framework, version, `environment: "staging"` first, `modelId` and `fallbackModelId`, tools, graph nodes, `params` (start from `defaultModelParams`), `limits` (`maxSteps`, `deadlineMs`, `costBudgetUsd`, `noProgressSteps`), `slo` and `evalDataset`. In the sample this is an entry in `agentBase` in `lib/data/agentops.ts`; when wired, it is the registration call.
2. **Prompt.** On Prompts, create the prompt (`prm-`) with a first version labelled `staging`, document every `{{variable}}`, and attach the guardrail names. Set `promptVersion` on the agent to that version.
3. **Tools.** On Tools & MCP, make sure every tool string on the agent exists in the registry (the test `tools-data.test.ts` enforces this). Set the permission matrix row for the agent: deny Destructive, approval for Write, allow Read, then relax deliberately. For MCP tools, confirm the server is Connected, signed and reviewed.
4. **Knowledge.** If the agent retrieves, add it to the knowledge base's `access.agentIds` and run a test retrieval against ten realistic queries. Check hit rate before the agent goes near users.
5. **Guardrails.** On Guardrails, scope the fleet-wide policies and add agent-specific ones. The Coverage tab must show no gap in Input for external exposure and no gap in Action for agents with write tools. Pick `fail_closed` for Action and Data policies.
6. **Evals.** Create or reuse a golden dataset and point `evalDataset` at it. Run a Manual eval on the staging version; the gate needs composite at or above 85, zero regressions, PII probes at 100 percent, and p95 and cost within the budgets you set for the agent in `gateBudgets`.
7. **Budget and routing.** On Costs & Budgets add an agent-scoped daily budget with thresholds (50 / 80 / 100) and an `onBreach` action the owner agrees with. On Providers & Routing add the agent to a fallback rule and set an agent-scoped rate limit.
8. **Schedules and triggers.** If the agent runs on its own, add the schedule or trigger with a per-run budget, concurrency policy and notifications. Check the freeze calendar.
9. **Readiness.** Run a readiness assessment for the agent's profile at target `pilot`. Clear the blockers before production. See [run a readiness assessment](run-a-readiness-assessment.md).
10. **Release to production.** On Deployments, create a release with strategy Canary (or Shadow first for a new model), approvers appropriate to the risk, and advance through the steps while watching the rollout chart and Review Queue sampling (`reviewRate` higher than normal for the first week).

## What to record

- Every step above writes to the audit log under its own source when done through the UI (`prompt`, `tool-permission`, `guardrail`, `budget`, `release`, `agent-config`).
- The readiness snapshot named for the go-live decision.

## Who to notify

- Reviewers, with the rubric expectations for the new agent.
- Service desk lead if the agent touches tickets or users.
- Platform owner for the production release approval.
