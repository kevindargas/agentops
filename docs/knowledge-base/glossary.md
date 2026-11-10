# Glossary

Terms are grouped by area. Type names in `code` refer to `lib/types.ts` unless another file is named.

## Identifiers

Every record type has a stable id prefix. Breadcrumbs render these prefixes verbatim in monospace (`components/layout/breadcrumbs.tsx`), and cross-links between pages use them.

| Prefix | Record | Example | Where |
| --- | --- | --- | --- |
| `agt-` | Deployed agent | `agt-support-triage` | `/agentops/agents/[id]` |
| `tr_` | Agent trace | `tr_…` | `/agentops/traces/[id]` |
| `exp-` | Experiment | `exp-…` | `/agentops/experiments` |
| `sem-` | Semantic entity | `sem-open-incident` | `/agentops/semantic-layer?entity=` |
| `prm-` | Prompt | `prm-…` | `/agentops/prompts/[id]` |
| `p-N` | Prompt version (global, numeric) | `p-41`, shown as v41 | Prompt record, Versions tab |
| `ev-` | Eval run | `ev-…` | `/agentops/evals/[id]` |
| `gate-` | Release gate (one per agent) | `gate-support-triage` | Evals & Datasets, Gates |
| `rel-` | Release | `rel-…` | `/agentops/deployments/[id]` |
| `grd-` | Guardrail policy | `grd-…` | `/agentops/guardrails?policy=` |
| `rev-` | Review item (`rev-s…` when queued this session) | `rev-…` | `/agentops/reviews?item=` |
| `rec-` | Recommendation | `rec-…` | `/agentops/recommendations?rec=` |
| `rt-` | Routing rule | `rt-004` | Providers & Routing, Routing (`?rule=`) |
| `sch-` | Schedule | `sch-…` | Schedules & Triggers |
| `trg-` | Trigger | `trg-…` | Schedules & Triggers |
| `frz-` | Freeze window | `frz-003` | Schedules calendar |
| `aud-` | Audit event (chronological) | `aud-000123` | `/agentops/audit` |
| `drf-` | Drift signal | `drf-001` | Drift & Quality |
| `bud-` | Budget | `bud-001` | Costs & Budgets |
| `key-` | API key | `key-002` | Providers, Keys |
| `prv-` | Provider | `prv-anthropic` | Providers |
| `u-` | User | `u-001` (Kevin Dargas) | Users & Groups |
| `ci-` | Configuration item (system or service) | `ci-001` | Internal only, referenced by `ciId` |
| `asm-`, `snap-` | Readiness assessment and snapshot | generated client-side | Readiness, Share tab |
| `INC`, `PRB`, `CHG`, `REQ`, `RITM`, `SCTASK`, `KB` | Service-management records | `INC0010048` | `/itsm/...` |
| `VIS-`, `QUA-`, `DRF-`, `SAF-`, `CST-`, `GOV-` | Readiness controls by domain | `VIS-01` | Readiness, Controls tab |

Control ids must stay stable because exported assessments and share links reference them. `recordHref()` in `components/shared/record-link.tsx` turns any of these prefixes into its route, which is how the command menu, the audit log and related-record chips link.

## Agents and runs

- **Deployed agent** (`DeployedAgent`): a production or staging agent with a framework (LangGraph, LangChain, Custom), a version, a model id, an optional fallback model, tools, a graph, metrics, 14-day quality and traffic trends, a drift score, an eval dataset, a prompt version, `params`, `limits`, `slo` and `errorBudget`.
- **Agent health** (`AgentHealth`): Healthy, Degraded, Drifting or Paused. Paused agents accept no new runs and carry a `pausedReason`.
- **Graph node** (`GraphNode`, `GraphNodeType`): a step in the agent's state graph. Types are router, llm, retriever, tool, human, guard and chain. Spans carry the same type.
- **Model parameters** (`ModelParams`): the single shape for generation and agent-loop settings. See [model parameters](concepts/model-parameters.md).
- **Reasoning effort** (`ReasoningEffort`): none, low, medium or high. The thinking budget a model spends before answering.
- **Tool choice**: `auto` (model decides), `required` (must call a tool) or `none` (answer from context only).
- **Run limits** (`RunLimits`): hard bounds on one run: `maxSteps`, `deadlineMs`, `costBudgetUsd` and `noProgressSteps` (consecutive steps without new tool output or state change). When a bound ends a run, the trace records which one in `boundHit`.
- **Bound hit** (`BoundHit`): `max_steps`, `deadline`, `cost_budget` or `no_progress`. Shown as a small warning flag next to the outcome.
- **SLO** (`AgentSlo`): per-agent targets for availability (percent), p95 latency (ms), quality (0 to 100) and safe completion (percent).
- **Error budget** (`ErrorBudget`): share of the 28-day budget still unspent (`remaining`, 0 to 1) and burn rates over 1 hour and 6 hours, where 1.0 means spending exactly on pace. Derived from observed error rate, p95 and quality against the SLO.
- **Fleet controls** (`FleetControls`): the kill switch (no agent accepts new runs) and writes disabled (agents answer but every write-capable tool is refused). Both are off by default and engaging either asks for confirmation.
- **Fleet totals and baseline** (`fleetTotals`, `fleetQualityBaseline` in `lib/data/agentops.ts`): the 24-hour request, token and cost totals the Fleet Overview quotes, and the quality score (89.5) the drift board compares against.
- **Telemetry health** (`telemetryHealth` in `lib/data/agentops.ts`): health of the trace pipeline itself: sample rate, trace coverage, dropped span rate, export failures in 24 hours and ingestion lag p95.

## Traces

- **Trace** (`AgentTrace`): one run of an agent: query, final answer, tokens in and out, cost, model, version, user feedback, evaluator scores (`grounded`, `helpful`, `safe`, each 0 to 1), flags, spans, lineage, optional streaming stats and optional experiment variant.
- **Span** (`TraceSpan`): one step in a trace with a type, start offset, duration, status (ok, error, skipped), optional model, finish reason, requested and served model ids, tokens, cost, input, output and attributes.
- **Trace status** (`TraceStatus`): the review-workflow state: Succeeded, Failed, Needs review, Reviewed.
- **Trace outcome** (`TraceOutcome`): what actually happened: `completed`, `partial`, `refused`, `invalid_output`, `tool_error`, `timeout`, `rate_limited`, `abandoned`. Refused and partial are still "ok" runs. Labels live in `features/agentops/shared.tsx`.
- **Trace flag** (`TraceFlag`, the `traceFlags` tuple): Low confidence, Hallucination risk, Missing citation, Policy: PII, Tool error, Long latency. The Traces flag facet is built from the tuple.
- **Finish reason** (`FinishReason`): why the model stopped on an LLM span: stop, length, tool_calls, content_filter, error.
- **Lineage** (`TraceLineage`): everything needed to reproduce a run: code SHA, prompt version, params hash, index build id, tool schema versions, policy version.
- **Streaming** (`TraceStreaming`): time to first token, tokens per second, whether the client disconnected and whether the stream was truncated.
- **Channel** (`TraceChannel`): Web, Slack, Teams, API or Email.

## Review

- **Review item** (`ReviewItem`): a trace sampled or flagged into the human queue with a reason (Low confidence, User thumbs-down, Evaluator flag, Random sample, Policy match), a priority, a status (Pending, Approved, Flagged, Corrected), an optional rubric, correction and note.
- **Rubric** (`ReviewRubric`): four criteria scored 1 to 5: accuracy, grounding, tone, safety.
- **Correction**: a reviewer-written better answer. Saved to the eval set, which is how review feeds datasets.
- **Pending count**: `pendingReviewCount()` in `lib/data/agentops.ts`; the Review Queue badge, the Pending stat card and My Work all use it (58 items, 36 pending in the sample).

## Drift and quality

- **Drift signal** (`DriftSignal`): a metric that moved away from its baseline for one agent. Kinds are input, output, quality, tool and cost. Severity is Info, Warning or Critical; state is Open, Acknowledged or Resolved. Carries a baseline, current value, explanation and 14-day history.
- **Baseline**: the reference window the metric is compared against. For inputs it is a population stability index (PSI) of the topic mix; for quality it is the evaluator score at the last known-good release. See [drift and baselines](concepts/drift-and-baselines.md).
- **Drift score** (`DeployedAgent.driftScore`): PSI of inputs versus baseline, 0 to 1.
- **Experiment** (`Experiment`): an A/B test of kind model, prompt, retrieval or tooling with two variants, a traffic split to B (`defaultExperimentSplit`, 20 percent, for drafts), a primary metric (quality, cost or latency), a significance (probability B beats A), an optional winner and daily readings. Status: Draft, Running, Completed, Promoted, Stopped.
- **Significance threshold** (`SIGNIFICANCE_THRESHOLD` in `lib/data/agentops.ts`): 0.95. At or above it with B ahead, the experiment is "ready to decide"; Promote and Stop ask for confirmation.
- **Recommendation** (`ModelRecommendation`): an evidence-backed proposal to move an agent from one model to another. Kinds: cost, quality, latency, deprecation, context. Status: New, Testing, Applied, Dismissed. May link to an experiment.

## Semantic layer

- **Semantic entity** (`SemanticEntity`): a governed definition of kind metric, dimension, entity or glossary with a domain, definition, optional formula, sources, synonyms, owner, status (Verified, Draft, Needs review, Deprecated), the agents allowed to use it, 30-day query count and lint issues.

## Prompts and playground

- **Prompt** (`Prompt` in `lib/data/prompts.ts`): a registry entry owned by an agent with a type (system, user_template, tool_description, evaluator_rubric), attached guardrails (`guardrailIds`, names through `promptGuardrailNames`), documented variables and immutable versions.
- **Prompt version** (`PromptVersion`): `p-N`, with a label (production, staging, draft, archived), a review state (Approved, Pending Approval, Rejected), author, change note, eval score, model and params, template and 24-hour usage. Exactly one production version per prompt.
- **Variable**: a `{{name}}` placeholder in a template, documented with description, example and required flag.
- **Playground config** (`PlaygroundConfig`): agent, prompt version, model and params. Runs are simulated deterministically from a hash of config and input (`simulateRun`), so the same input and settings always give the same transcript.

## Tools & MCP

- **Tool** (`Tool` in `lib/data/tools.ts`): a snake_case function the model can call, with a source (mcp, builtin, http, code), risk (Read, Write, Destructive), approval policy (Auto, Require approval, Blocked), status, allowlisted agents, call metrics, JSON-schema input, `idempotent`, `supportsDryRun`, optional `maxTransactionUsd` and `compensatingToolId`, `outputSinks` and an `identity`.
- **Output sink** (`ToolOutputSink`): where a tool's output goes: renders_html, executes_code, fetches_url, sends_message, writes_record or none. Sinks that render or execute need output guardrails.
- **Tool identity** (`ToolIdentity`): `service` (runs as the platform) or `delegated` (acts as the requesting user) with audience, scopes and token TTL.
- **MCP poll interval** (`mcpPollIntervalSec`, 30): how often the registry re-reads server definitions; the MCP tab quotes it.
- **MCP**: Model Context Protocol. An **MCP server** (`McpServer`) exposes tools, resources and prompts over stdio, streamable-http or sse, with auth (OAuth 2.1, API key, mTLS, none), a protocol version, a `definitionDigest` of the advertised definitions, `signatureVerified`, an egress allowlist, optional EOL date and a vulnerability count.
- **Permission matrix** (`ToolPermission`): one decision (allow, approval, deny) per agent per risk level.

## Knowledge and memory

- **Knowledge base** (`KnowledgeBase`): a vector index on a store (pgvector, Pinecone, Weaviate, Elasticsearch, Vertex AI Search, Bedrock KB) with an embedding model, chunking config, retrieval config (top-k, hybrid weight, reranker, score threshold, MMR), access policy (agents, PII filter, ACL inheritance, roles), status (Healthy, Syncing, Stale, Error) and hit rate. Stale means no sync in 7 days.
- **Source** (`KbSource`) and **ingestion job** (`IngestionJob`): a connector (Confluence, SharePoint, GitHub, Zendesk, Notion, S3, Website, ITSM Knowledge) on a cron schedule, and each run of it (Queued, Running, Completed, Failed).
- **Memory store** (`MemoryStore`): per-agent memory of type session, user long-term, organisational, episodic or procedural on Redis, Postgres, Mem0, Letta or Zep, with TTL, PII policy (redact, encrypt, deny) and write policy (agent-writable, curated, read-only).
- **Low-recall query** (`LowRecallQuery`): a query whose best chunk score fell under threshold, with the outcome the agent produced.

## Guardrails

- **Guardrail policy** (`Guardrail`): a policy-as-code rule in category Input, Output, Action or Data with a mode (Block, Flag, Redact, Require approval), an engine (regex, classifier, llm-judge, schema, policy-engine), scope (all agents or a list), optional threshold, YAML policy source, trigger metrics, false-positive rate, `failMode`, p95 evaluation latency, `bypassRate` from the last red-team run and status (Active, Disabled, Draft).
- **Fail mode** (`GuardrailFailMode`): `fail_closed` rejects the turn when the engine errors; `fail_open` lets it through unguarded.
- **Violation** (`GuardrailViolation`): one trigger with action (Blocked, Flagged, Redacted, Approval requested), severity, redacted snippet, trace link and verdict (Verified, Dismissed, Pending).
- **Coverage** (`GuardrailCoverage`): per agent, how many policies cover each category and which categories have gaps, scored 0 to 100.

## Evaluation

- **Evaluator** (`Evaluator`): a scorer of type LLM-as-judge, Rubric, Exact match, JSON schema, Embedding similarity, Regex, Custom code or Human that measures one thing (faithfulness, answer relevance, tool-call accuracy, SQL validity, policy compliance, tone, latency budget, cost budget, output format, semantic match, PII leak, overall quality) on a scale, with a cost per case and a human-agreement calibration history.
- **Golden dataset** (`EvalDataset`): versioned cases with a schema (input, expected, metadata), sources (production traces, human-authored, synthetic, review corrections), tags and evaluators. `DeployedAgent.evalDataset` points at one.
- **Eval run** (`EvalRun`): one dataset evaluated against one agent, prompt version and model, triggered Manual, CI, Scheduled or Pre-deploy, with a composite score (0 to 100), per-evaluator means, pass rate, delta versus a baseline run, regressions and improvements.
- **Eval case** (`EvalCase`): one input with expected and actual output, per-evaluator scores and rationales, pass flag and change (regression, improvement, same).
- **Release gate** (`ReleaseGate`): five rules per agent: composite at or above 85 (`GATE_THRESHOLD` in `lib/data/deployments.ts`), zero regressions, 100 percent PII-probe pass, p95 within budget, cost per case within budget. Passed or Failed, and `enforced` or advisory.
- **Eval gate snapshot** (`EvalGate` on a release): status, score, threshold, run id and, when failed, a `reason` such as "1 regression on kb-draft-v4". Draft releases have none yet.

## Deployments

- **Release** (`Release` in `lib/data/deployments.ts`): a versioned change to an agent in an environment with a strategy, traffic steps, stage, change list (prompt, model, tools, params, retrieval), eval gate, current traffic share, health deltas, risk, guardrail coverage, cost delta, approvers, rollback target, rollout points and activity.
- **Release stage** (`ReleaseStage`): Draft, Pending approval, Canary, Progressing, Promoted, Rolled back, Failed.
- **Strategy** (`ReleaseStrategy`): Canary (step traffic up), Blue-green (switch all at once with instant rollback), Shadow (mirror traffic, serve baseline), Direct (replace). See [deployment strategies](concepts/deployment-strategies.md).
- **Environment** (`ReleaseEnvironment`): production, staging, development, shadow. The environments matrix shows which version, model and prompt each agent runs where.
- **Release approval** (`ReleaseApproval`): approvers with roles and evidence (eval gate, experiment significance, guardrail coverage, cost delta).

## Schedules and triggers

- **Schedule** (`Schedule`): a cron expression with timezone, concurrency policy (Forbid, Allow, Replace), retry policy, per-run budget, parameters and notifications. `describeCron` renders it in plain language; `nextRun` computes the next occurrence after the demo clock.
- **Trigger** (`Trigger`): an event source (Webhook, Slack mention, Email inbox, Queue, Record event, Drift signal, Budget threshold, Eval failure, Git push) with a condition, an action (Run agent, Open review, Notify), a secret status and delivery history.
- **Freeze window** (`FreezeWindow`): a period during which deploys or runs in scope are skipped. `freezeAt(iso)` returns the active window.
- **Scheduled run** (`ScheduledRun`): one execution with status Succeeded, Failed, Running or Skipped, items processed, cost and a trace link.

## Providers, routing and keys

- **Provider** (`Provider`): a model vendor connection (status Connected, Degraded, Disconnected) with regions, base URL, credential type, enabled and available models, 24-hour metrics and latency trend.
- **API key** (`ApiKey`): a scoped credential for one provider and environment with status Active, Expiring, Revoked or Rotating, expiry and monthly spend.
- **Key rotation grace** (`keyRotationGraceHours`, 24): how long the old key keeps working after Rotate; `expiringKeyCount(days)` feeds the Keys tab warning (14 days).
- **Routing rule** (`RoutingRule`): a strategy (Priority fallback, Weighted, Lowest latency, Lowest cost, Region-pinned) over an ordered chain of model and provider targets, with conditions (on 429, on 5xx, on timeout, on cost over budget), timeout, retries and fallback hits. `routingRuleConfig` renders it as gateway JSON; `simulateRoute` walks the chain with chosen failures.
- **Rate limit** (`RateLimit`): RPM, TPM and concurrency caps per agent, provider or key with current usage, burst and throttled count.

## Costs

- **Budget** (`Budget`): a limit for a team, agent or project per day or month, with alert thresholds as percent of limit, an `onBreach` action (Alert only, Throttle, Downgrade model, Pause agent) and a status: On track, At risk (projection at or above 90 percent of limit) or Exceeded (spent at or above limit).
- **Forecast**: `forecastMonthEnd()` projects month-end spend linearly from the trailing 14 full days.
- **Spend today** (`costToday`, the last `CostDay`): $571.20 in the sample, split by agent and provider (`spendTodayByAgent`, `spendTodayByProvider`, `spendByProvider`). `budgetsAtRiskCount()` counts At risk and Exceeded budgets; `costByAgentWindowDays` (7) is the allocation window.
- **Savings opportunity** (`SavingsOpportunity`): route, caching, output-tokens, batch or commitment, with estimated monthly saving and effort.

## Audit

- **Audit event** (`AuditEvent`): an append-only record with actor (user, agent or system), dotted action such as `prompt.version.promoted` or `release.rolled_back`, one of eleven sources (prompt, guardrail, release, review, tool-permission, mcp-server, budget, memory, api-key, agent-config, readiness), target with href, summary, before and after, context (agent, trace, prompt version, model, policy version, approval id, release id, reason), `hash` and `prevHash`. The seed holds `aud-000001` to `aud-000140`.
- **This session**: records appended by your own actions through `auditStore.append` (`features/agentops/audit/audit-store.ts`). They continue the id sequence, chain onto the last seeded hash, carry a "This session" badge and disappear on reload.
- **Hash chain**: each event's hash is a digest over the previous hash and the event's identifying fields. `verifyAuditChain` walks from the genesis hash (`AUDIT_GENESIS_HASH`) and reports the first broken event; "Verify chain" on the Audit Log runs it over seed plus session records.
- **Retention** (`AuditRetention`): 400 days, immutable storage, legal-hold list, last integrity check.

## Readiness

- **Control** (`ControlDef` in `lib/readiness/types.ts`): one requirement with what, why, how, done-looks-like, risk weight 1 to 5, effort, earliest required maturity stage, optional gate flag, applicability rule, framework references, tools, metrics, snippets and review cadence.
- **Domain** (`DomainId`): visibility, quality, drift, safety, cost-performance, governance. Six in total, 86 controls.
- **Control status** (`ControlStatus`): none, planned, partial, in-place, verified. Credits 0, 0.15, 0.5, 0.85 and 1.
- **Maturity target** (`MaturityTarget`): prototype, pilot or production. Controls become required at a stage.
- **Maturity level** (`MaturityLevel`): the result: ad-hoc (below 40), defined (40 to 64), managed (65 to 84), optimized (85 and above with half of required controls verified).
- **Gate control**: a control flagged `gate`; when required and not In place or Verified it is a **blocker**.
- **Applicability**: applies, reduced (weight halved) or not-applicable (hidden) depending on system type, autonomy, data sensitivity, exposure and regulatory scope.
- **Snapshot**: a frozen copy of an assessment for history and diff; up to 25 are kept.
- **Team mode**: one vote per respondent per control; the consensus is the majority, ties resolve downward.

## Service management and health

- **Incident, Problem, Change, Request, Requested item (RITM), Catalog task (SCTASK), Knowledge article**: the ITIL records in `lib/types.ts` with their state machines in `lib/constants.ts`. Priority is derived from impact and urgency through `calculatePriority`.
- **Configuration item** (`ConfigurationItem`): a system or business service agents plug into. Internal data only; there is no inventory page.
- **Alert** (`Alert`) and **Service health** (`ServiceHealth`): event-management records and per-service health (Healthy, Degraded, Critical, Unknown) with 30-day availability against `availabilitySlo` (99.9 percent) and open counts. `openAlertCount()` (not Closed) is the sidebar badge; `unacknowledgedAlertCount()` the morning number.
- **CAB slot** (`cabSchedule` in `lib/constants.ts`): Thursday 09:00 UTC; `nextCab()` in `lib/data/itsm.ts` computes the next meeting. `changeFreezeWindows` are the freeze periods the change calendar shades. `onHoldReminderDays` (2), `onHoldAutoResolveDays` (5), `incidentAutoCloseDays` (3), `approvalReminderHours` (18), `slaComplianceTarget` and `changeSuccessTarget` (95) are the other service-management defaults.
- **Problem incidents**: `incidentsForProblem(number)` derives a problem's linked incidents from the incidents that carry its id, so the count on the problem always matches the Incidents tab.

## Shell and client state

- **Page header** (`PageHeader nav=`): the header every page renders; `nav` is the page's route and resolves eyebrow (sidebar group), icon and title from `config/nav.ts`.
- **Stat grid** (`StatGrid`, `StatCard`, `StatDelta`): the KPI row. Cards have no icons; deltas are derived by `lib/data/metrics.ts` (`compareWindows`, `countInWindows`, `openCountDelta`) and never typed in. `MetricTile` is the inline variant inside cards and sheets.
- **Eyebrow** and **count pill** (`Eyebrow`, `CountPill`): the small uppercase label above a title and the numeric badge on tabs and section titles.
- **Session store** (`createListStore` in `lib/store.ts`): a module-scoped list seeded from `lib/data` that every table, stat card and sheet on a page reads through `use()` and mutates through `patch`, `add`, `remove`. Edits persist for the session and reset on reload; nothing is written to `localStorage`. Instances live in `features/agentops/stores.ts`, `features/agentops/<feature>/store.ts` and `features/<module>/<module>-store.ts`.
- **Persisted store** (`createStore(initial, storageKey)`): the `localStorage`-backed variant used only by the readiness assessment, the theme customizer and the assistant settings.
- **Nav badge** (`NavBadgeKey`, `getNavCounts()` in `config/nav-counts.ts`): the sidebar counts for Approvals, Review Queue, Recommendations, Workflow Automations and Alerts, computed on the server from the same selectors the pages use.
- **Deep link**: a query parameter with a reader, such as `?tab=`, `?tool=`, `?policy=`, `?kb=`, `?alert=`, `?item=`, `?new=1`. The full contract is in [conventions](../development/conventions.md); `useQueryParam` in `hooks/use-query-param.ts` reads and writes them without a server round trip.
- **Keyboard contract** (`shouldIgnoreShortcut` in `components/layout/command-menu.tsx`): single-key shortcuts (`C`, `D`, `G` chords) stand down while typing, inside dialogs, sheets, menus, the command palette and the assistant panel, when a modifier is held, and when a page handler has called `event.preventDefault()`.
- **Truthful toast**: a toast that describes only what changed in local state (or a real download or clipboard write). The app has no toast that claims a send, export or audit entry that did not happen.
- **Loading skeletons** (`TableSkeleton`, `RecordSkeleton`, `PageSkeleton` in `components/shared/skeletons.tsx`): the `loading.tsx` content for list routes, record routes and everything else.
- **Chart tokens** (`--chart-1` to `--chart-8`): the categorical palette every chart draws from; 6 to 8 extend the original five for the readiness domains. `CHART_HEIGHT` fixes chart heights at 180, 240 or 280 pixels.
- **Clock** (`clock()` in `lib/data/seed.ts`): the only way to read the current time; returns the frozen `NOW`.

## Assistant

- **AgentOps Assist**: the docked assistant panel. A scripted engine (`planResponse` in `lib/ai/assistant.ts`) produces reasoning, tool calls, markdown, actions and follow-ups for a prompt and page context.
- **Workflow agent** (`AiAgent` in `lib/ai/agents.ts`): an internal automation with an autonomy level (`suggest`, `approve`, `autonomous`), tools, trigger and run history. **Proposal** (`AgentProposal`): a suggested change awaiting approval.
- **Agentic template** (`AgentTemplate` in `lib/ai/templates.ts`): a reusable prompt such as quality regression review or spend review that runs against the current record.
