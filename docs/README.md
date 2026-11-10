# AgentOps documentation

AgentOps is a Next.js 16 / shadcn UI application for operating a fleet of AI agents the way you would operate production services: traces, human review, drift and quality monitoring, experiments, prompts, tools, guardrails, evals, releases, budgets and a readiness assessment, next to the incident, change and service-health workflows those agents plug into.

## Who this is for

| Reader | Start with |
| --- | --- |
| Platform operator running the fleet day to day | [Operator checklist](operator-checklist.md), then the feature guides |
| New team member learning the vocabulary | [Glossary](knowledge-base/glossary.md) and [FAQ](knowledge-base/faq.md) |
| Engineer wiring the UI to real systems or extending it | [Development](development/architecture.md) |

## Start here

- [Getting started](getting-started.md): prerequisites, install, every pnpm script, first run, environment, shortcuts, deployment, browser storage.
- [Operator checklist](operator-checklist.md): what to check every morning, every week, before every release and every quarter, with the page to open and the first action to take.

## Feature guides

### Agent Operations

- [Fleet Overview](features/agent-operations/fleet-overview.md): traffic, quality, spend, review volume, outcomes, telemetry health, agents needing attention, kill switch and writes-disabled controls.
- [Agents](features/agent-operations/agents.md): deployed agents with model, tools, owner, health, drift score, run limits, SLO and error budget, rendered state graph.
- [Traces](features/agent-operations/traces.md): every run with spans, tokens, cost, evaluator scores, outcome, lineage and a span waterfall.
- [Review Queue](features/agent-operations/review-queue.md): human review workspace with a four-criterion rubric and approve / flag / correct / skip.
- [Drift & Quality](features/agent-operations/drift-and-quality.md): input, output, quality, tool and cost signals against each agent's baseline.
- [Experiments](features/agent-operations/experiments.md): A/B tests on models, prompts, retrieval and tooling with significance and promotion.
- [Recommendations](features/agent-operations/recommendations.md): evidence-backed model and configuration changes.

### Build

- [Prompts](features/build/prompts.md): registry with immutable versions, labels, line-level diff, variables, per-version parameters and eval scores.
- [Playground](features/build/playground.md): generation-parameter editor, simulated runs, A/B compare, diff against deployed, save as version.
- [Tools & MCP](features/build/tools-and-mcp.md): tool registry, MCP servers with integrity data, agents x risk permission matrix.
- [Knowledge & Memory](features/build/knowledge-and-memory.md): vector indexes, ingestion sources and jobs, memory stores, retrieval quality, test retrieval.
- [Semantic Layer](features/build/semantic-layer.md): governed metrics, dimensions, entities and glossary agents may use.
- [Model Catalog](features/build/model-catalog.md): live OpenRouter catalog with facets, pricing and pin-to-picker.
- [Workflow Automations](features/build/workflow-automations.md): internal workflow agents, proposals, autonomy levels, approval queue.

### Govern

- [Guardrails](features/govern/guardrails.md): policy-as-code rules, violations log, coverage matrix, offline policy tester.
- [Evals & Datasets](features/govern/evals-and-datasets.md): eval runs, case comparison grid, golden datasets, evaluators, release gates.
- [Deployments](features/govern/deployments.md): releases with canary / blue-green / shadow / direct strategies, rollout chart, environments, approvals.
- [Audit Log](features/govern/audit-log.md): append-only, hash-chained record of who changed what.
- [Schedules & Triggers](features/govern/schedules-and-triggers.md): cron schedules, event and webhook triggers, freeze windows, run history.
- [Providers & Routing](features/govern/providers-and-routing.md): provider connections, scoped API keys, routing rules, rate limits.
- [Costs & Budgets](features/govern/costs-and-budgets.md): spend by agent, model and provider, budgets with thresholds and breach actions, forecast, savings.
- [Readiness Assessment](features/govern/readiness-assessment.md): self-assessment against 86 controls in six domains, scoring, framework mappings, sharing.

### Workspace

- [Overview dashboard](features/workspace/overview-dashboard.md): fleet health, spend, review queue, drift and failing evals, then incidents and changes.
- [My Work](features/workspace/my-work.md): reviews, experiments, assignments and approvals for the signed-in user.
- [Approvals](features/workspace/approvals.md): changes and requests awaiting approval.
- [Analytics](features/workspace/analytics.md): performance analytics and reporting.

### Service Management

- [Incidents](features/service-management/incidents.md)
- [Problems](features/service-management/problems.md)
- [Changes](features/service-management/changes.md)
- [Requests](features/service-management/requests.md)
- [Service Catalog](features/service-management/service-catalog.md)
- [Knowledge](features/service-management/knowledge.md)

### Service Health

- [Service Health](features/service-health/service-health.md)
- [Alerts](features/service-health/alerts.md)

### Administration

- [Users & Groups](features/administration/users-and-groups.md)
- [Settings](features/administration/settings.md)

### Assistant and shell

- [Assistant and shell](features/assistant-and-shell.md): AgentOps Assist panel, command menu, notifications, quick create, theme customizer.

## Knowledge base

- [Knowledge base index](knowledge-base/README.md)
- [Glossary](knowledge-base/glossary.md)
- [FAQ](knowledge-base/faq.md)
- [Troubleshooting](knowledge-base/troubleshooting.md)
- Concepts: [traces and spans](knowledge-base/concepts/traces-and-spans.md), [drift and baselines](knowledge-base/concepts/drift-and-baselines.md), [evaluation and release gates](knowledge-base/concepts/evaluation-and-release-gates.md), [guardrails and policies](knowledge-base/concepts/guardrails-and-policies.md), [deployment strategies](knowledge-base/concepts/deployment-strategies.md), [routing and providers](knowledge-base/concepts/routing-and-providers.md), [model parameters](knowledge-base/concepts/model-parameters.md), [readiness scoring](knowledge-base/concepts/readiness-scoring.md)
- Runbooks: [triage a flagged trace](knowledge-base/runbooks/triage-a-flagged-trace.md), [handle a drift signal](knowledge-base/runbooks/handle-a-drift-signal.md), [promote an experiment](knowledge-base/runbooks/promote-an-experiment.md), [roll back a release](knowledge-base/runbooks/roll-back-a-release.md), [rotate an API key](knowledge-base/runbooks/rotate-an-api-key.md), [respond to a budget breach](knowledge-base/runbooks/respond-to-a-budget-breach.md), [onboard a new agent](knowledge-base/runbooks/onboard-a-new-agent.md), [run a readiness assessment](knowledge-base/runbooks/run-a-readiness-assessment.md)

## Development

- [Architecture](development/architecture.md)
- [Conventions](development/conventions.md)
- [Adding a module](development/adding-a-module.md)
- [Theming](development/theming.md)
- [Testing](development/testing.md)
- [Wiring real data](development/wiring-real-data.md)
- [Deployment](development/deployment.md)
