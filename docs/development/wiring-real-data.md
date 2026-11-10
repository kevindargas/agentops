# Wiring real data

Every page reads from `lib/data`. Replace a data module with an API client that returns the same types and the UI keeps working. This page lists, per module, the types to satisfy, the getters pages call, and the client stores whose mutations become API calls.

## General pattern

1. Keep `lib/types.ts` (and the per-module exported types) as your contract. Change the type first if your backend differs, then let the compiler show you every consumer.
2. Server components `await` data. Replace `import { deployedAgents } from "@/lib/data"` with `const agents = await client.agents.list()` in the page; tables accept any array of the right type. Client components import specific modules (`@/lib/data/agentops`); keep that so your API client stays tree-shakeable.
3. Mutations in the sample app go through module-scoped `createListStore` instances (`features/agentops/stores.ts`, `features/agentops/<feature>/store.ts`, `features/<module>/<module>-store.ts`). Every table, stat card and sheet on a page reads the same store. Replace the body of each `patch` / `add` / `remove` call site with a server action or a fetch, keep the optimistic store update, and surface errors through the existing toast. The toasts already describe only what changed locally; keep them truthful when the write goes remote.
4. Stat-card deltas come from `lib/data/metrics.ts` (`compareWindows`, `countInWindows`, `sumInWindows`, `openCountDelta`). Feed those helpers your real series or replace them with server-computed `{ current, previous, delta, deltaPct }` objects of the same shape.
5. Sidebar badges come from `getNavCounts()` in `config/nav-counts.ts`, which runs in `app/(app)/layout.tsx`. Point each key at your API's count endpoint; the search index for the command menu (`components/layout/search-index.ts`, `buildSearchIndex()`) is built in the same place.
6. The frozen clock is `clock()` in `lib/data/seed.ts`. For real data switch it to the wall clock there, pass the real reference time into `timeAgo(iso, base)`, or move relative times into a client-only component to avoid hydration mismatches.
7. Write every mutation to the audit log (one `AuditEvent` per change) rather than keeping per-feature histories. In the template, Guardrails, Evals and Deployments append through `auditStore.append` (`features/agentops/audit/audit-store.ts`); replace that with a call to your append-only store.
8. Keep the `loading.tsx` files: once data really is asynchronous, `TableSkeleton` and `RecordSkeleton` are what users see during the fetch.

## Agent telemetry

Module: `lib/data/agentops.ts`. Shaped like what an OpenTelemetry or LangSmith-style exporter produces.

| Export | Type | Used by |
| --- | --- | --- |
| `deployedAgents`, `getDeployedAgent(id)` | `DeployedAgent` with `params`, `limits`, `paused`, `slo`, `errorBudget` | Fleet Overview, Agents, agent record, every page that renders an agent chip |
| `fleetControls`, `fleetTotals`, `fleetQualityBaseline` | `FleetControls`; 24-hour totals; the quality baseline the drift board compares against | Fleet Overview, Drift & Quality |
| `telemetryHealth` | sample rate, trace coverage, dropped span rate, export failures, ingestion lag | Fleet Overview, Traces |
| `agentTraces`, `getTrace(id)`, `traceFlags` | `AgentTrace` with `TraceSpan[]`, `outcome`, `boundHit`, `lineage`, `streaming`; the flag tuple the facet is built from | Traces, trace record, Review Queue, Guardrails violations |
| `reviewItems`, `pendingReviewCount()` | `ReviewItem` | Review Queue, My Work, sidebar badge |
| `driftSignals`, `openDriftCount()`, `openDriftSeverity(agentId)` | `DriftSignal` | Drift & Quality, agent record, Fleet Overview attention list |
| `experiments`, `getExperiment(id)`, `defaultExperimentSplit`, `SIGNIFICANCE_THRESHOLD` | `Experiment` | Experiments, Recommendations |
| `modelRecommendations`, `openRecommendationCount()` | `ModelRecommendation` | Recommendations, sidebar badge |
| `semanticEntities`, `getSemanticEntity(id)` | `SemanticEntity` | Semantic Layer, agent record |
| `fleetDaily` | daily traffic, cost, reviews | Fleet Overview charts |

Stores to rewire: `agentStore` (pause, resume, run limits), `reviewStore` (Approve, Flag, Correct, Skip; `queueTraceForReview`), `driftStore` (Acknowledge, Resolve), `experimentStore` (Start, Stop, Promote, split; `draftExperiment`), `recommendationStore` (Testing, Dismiss, Applied), `semanticStore` (entity edits), all in `features/agentops/stores.ts`. Kill switch and writes disabled stay in `fleet-overview.tsx`.

Span fields map to OTel GenAI attributes: `modelId` to `gen_ai.request.model`, `responseModelId` to `gen_ai.response.model`, `tokensIn`/`tokensOut` to `gen_ai.usage.input_tokens`/`output_tokens`, `finishReason` to `gen_ai.response.finish_reasons`.

## Agent configuration

Module: `lib/data/agent-config.ts`. `getAgentOpsConfig(agentId)` assembles the agent record's configuration panel (autonomy, budgets with `budgetId`, `guardrailIds` and names, `knowledgeBaseIds` and names, schedule) from the other modules by id. With a real backend either keep the assembly and point the imports at your clients, or return the same `AgentOpsConfig` shape from one endpoint. `lib/data/playground.ts` re-exports it.

## Prompts and playground

Modules: `lib/data/prompts.ts`, `lib/data/playground.ts`.

Types: `Prompt` (with `guardrailIds`), `PromptVersion` (with `ModelParams`), `PromptVariable`. Getters: `prompts`, `getPrompt`, `getPromptVersion`, `getPromptForAgent`, `agentsUsingVersion`, `productionVersion`, `latestVersion`, `promptGuardrailNames`.

Store: `features/agentops/prompts/prompt-store.ts` (`createVersion`, `createPrompt`, promotion, review approval). The Playground reads versions from the same store and writes drafts back; `applied-config-store.ts` keeps the per-session "applied to agent" baseline. `simulateRun` in the playground should become a call to your inference endpoint returning `PlaygroundResult` (reasoning, tool calls, answer, truncated, metrics, warnings). Keep `configToSearchParams` and `configFromSearchParams` so playground links stay shareable.

## Tools & MCP

Module: `lib/data/tools.ts`. Types: `Tool`, `McpServer`, `ToolPermission`. Getters: `tools`, `getTool(name)`, `toolsForAgent`, `mcpServers`, `getMcpServer`, `toolPermissions`, `getPermission`, `toolStats`, `serverNeedsReview`, `toolIsSandboxed`, `mcpPollIntervalSec`.

Stores: `toolStore` and `serverStore` in `features/agentops/tools/store.ts` (permission matrix cells, tool status, server sign-off and revoke). The permission export (`Download` writes `tool-policy.json`, `Copy JSON`) reads the store, so it already reflects local edits.

## Knowledge and memory

Module: `lib/data/knowledge.ts`. Types: `KnowledgeBase`, `KbSource`, `IngestionJob`, `MemoryStore`, `RetrievalDaily`, `LowRecallQuery`, `KbChunk`. Getters: `knowledgeBases`, `getKnowledgeBase`, `kbSources`, `ingestionJobs`, `memoryStores`, `retrievalDaily`, `lowRecallQueries`, `searchKnowledgeBase`, `isKbStale`, `STALE_AFTER_DAYS`.

Stores: `kbStore`, `sourceStore` and `memoryStore` in `features/agentops/knowledge/store.ts` (Sync and Pause on sources, agent access, compaction on memory stores); `knowledgeTotals` recomputes the stat cards from them. Test retrieval (`searchKnowledgeBase`) becomes a query against your index.

## Guardrails

Module: `lib/data/guardrails.ts`. Types: `Guardrail`, `GuardrailViolation`, `GuardrailCoverage`. Getters: `guardrails`, `getGuardrail`, `guardrailsForAgent`, `guardrailCoverage`, `guardrailViolations`, `evaluateGuardrails`, `guardrailStats`.

Stores: `policyStore` and `violationStore` in `features/agentops/guardrails/store.ts` (enable, disable, threshold edits, rollback, new policy, verdicts with Undo); `computeGuardrailStats` recomputes the fleet cards from them. The Test tab should call your policy engine instead of `evaluateGuardrails` for classifier and judge engines.

## Evals and datasets

Module: `lib/data/evals.ts`. Types: `Evaluator`, `EvalDataset`, `EvalRun`, `EvalCase`, `ReleaseGate`. Getters: `evaluators`, `getEvaluator`, `evalDatasets`, `getDataset`, `evalRuns`, `getEvalRun`, `getEvalCases(runId)`, `releaseGates`, `getReleaseGate(agentId)`.

Stores: `datasetStore` and `gateStore` in `features/agentops/evals/store.ts` (`addCasesToDataset` and `bumpVersion` when corrections are added from the review queue, gate enforcement toggles); run and compare actions in `run-actions.tsx` are local to the run record. If your eval service computes gates, return `ReleaseGate` directly; otherwise port `buildGates`.

## Deployments

Module: `lib/data/deployments.ts`. Types: `Release`, `EnvironmentState`, `ReleaseApproval`, `EvalGate` (with `reason`). Getters and constants: `releases`, `getRelease`, `environments`, `getEnvironment`, `releaseApprovals`, `compareVersions`, `timeToPromoteHours`, `releasePromptVersion`, `decidedApprovers`, `pendingReleaseApprovalCount`, `activeReleaseCount`, `GATE_THRESHOLD`.

Stores: `releaseStore` and `decisionStore` in `features/agentops/deployments/store.ts` (Pause, Resume, advance, promote, rollback through `releaseStore.patch`; approve, reject and request changes through `decide`; `approvalsFrom` and `deploymentStats` derive the approvals tab and stat cards; `draftReleaseFromRun` and `draftReleaseFromStaging` create releases from Evals and the environments matrix). Each mutation should append a `ReleaseEvent` and an audit event.

## Schedules and triggers

Module: `lib/data/schedules.ts`. Types: `Schedule`, `Trigger`, `ScheduledRun`, `FreezeWindow`. Getters and helpers: `schedules`, `getSchedule`, `triggers`, `getTrigger`, `scheduledRuns`, `freezeWindows`, `freezeAt`, `describeCron`, `nextRun`, `occurrences`.

Stores: `scheduleStore`, `triggerStore` and `runStore` in `features/agentops/schedules/store.ts` (Enable, Disable, new schedule, new trigger, test delivery, `queueRun` for "Run now"). `nextRun` can stay client-side if your scheduler uses standard cron; otherwise return `nextRunAt` from the API.

## Providers and routing

Module: `lib/data/providers.ts`. Types: `Provider`, `ProviderIncident`, `ApiKey`, `RoutingRule`, `RateLimit`. Getters and helpers: `providers`, `getProvider`, `providerIncidents`, `apiKeys`, `getApiKey`, `expiringKeyCount`, `keyRotationGraceHours`, `routingRules`, `getRoutingRule`, `routingRuleConfig`, `simulateRoute`, `rateLimits`, `getRateLimit`, `agentsForRule`.

Stores: `providerStore`, `keyStore`, `routingStore` and `rateLimitStore` in `features/agentops/providers/store.ts` (Test connection, Rotate, Revoke with Undo, Pause rule, rate limit edits); `KEY_EXPIRY_WARNING_DAYS` (14) drives the expiring-key warning. `routingRuleConfig` emits gateway JSON; if you use a real gateway, generate its native config here.

## Costs and budgets

Module: `lib/data/costs.ts`. Types: `CostDay`, `Budget`, `AgentCost`, `SavingsOpportunity`. Getters: `costDaily`, `costToday`, `costByAgent`, `costByAgentWindowDays`, `spendTodayByAgent`, `spendTodayByProvider`, `spendByProvider`, `budgets`, `getBudget`, `budgetsAtRiskCount`, `savingsOpportunities`, `forecastMonthEnd`, `monthlyBudgetTotal`, `monthToDateSpend`, `modelPricing`.

Stores: `budgetStore`, `savingsStore`, `budgetNoteStore` in `features/agentops/costs/store.ts` (budget edits and breach actions, apply or dismiss opportunity). The CSV export is a real `Blob` download built from the store.

## Audit log

Module: `lib/data/audit.ts`. Types: `AuditEvent`, `AuditRetention`. Getters: `auditEvents`, `getAuditEvent`, `auditEventsSince`, `auditRetention`, `verifyAuditChain`, `auditDigest`, `AUDIT_GENESIS_HASH`.

Replace `build()` with a read from your append-only store and `auditStore.append` (`features/agentops/audit/audit-store.ts`) with a write to it. Keep `hash` and `prevHash` on every event so "Verify chain" still works; if your store hashes differently, port `auditDigest` or expose a server-side verify endpoint. Target hrefs must resolve to real routes in this app.

## Readiness

The readiness module is already client-side and needs no backend. If you want central storage, replace `createStore` in `lib/readiness/store.ts` with a store that syncs to your API while keeping the same `readinessStore` and `readinessActions` surface; `useReadiness()` in `features/agentops/readiness/shared.tsx` is the only consumer.

## Service management and health

Modules: `lib/data/itsm.ts`, `lib/data/itom.ts`, `lib/data/catalog.ts`, `lib/data/activity.ts`, `lib/data/users.ts`, `lib/data/cmdb.ts`. Types: `Incident`, `Problem`, `Change`, `Request`, `RequestedItem`, `CatalogTask`, `CatalogItem`, `KnowledgeArticle`, `Alert`, `ServiceHealth`, `ActivityEntry`, `Approval`, `Notification`, `User`, `Group`, `ConfigurationItem`. Helpers: `incidentsForProblem(number)`, `nextCab()`, `changeFreezeWindows`, `openAlertCount`, `unacknowledgedAlertCount`, `availabilitySlo`, `pendingApprovalCount`, `unreadNotificationCount`, `roles`, `SAMPLE_EMAIL_DOMAIN`. Priority is computed by `calculatePriority(impact, urgency)` in `lib/constants.ts`; `cabSchedule`, `slaComplianceTarget`, `changeSuccessTarget`, `onHoldReminderDays`, `onHoldAutoResolveDays` and `approvalReminderHours` live there too. Keep the matrix or replace it with your ITSM tool's.

Stores: `features/incidents/incidents-store.ts`, `features/problems/problems-store.ts`, `features/changes/changes-store.ts`, `features/requests/requests-store.ts`, `features/knowledge/knowledge-store.ts`, `features/itom/alerts-store.ts`, `features/admin/users-store.ts` (`usersStore`, `groupsStore`) and the shared `features/workspace/approvals-store.ts` (read by the approvals inbox and the change record). Create sheets (`?new=1`) append to these stores; alert bulk actions, approvals and user administration mutate them. These map one to one onto a ServiceNow-style API.

## The assistant

Module: `lib/ai/assistant.ts`. `planResponse(prompt, context)` returns an `AssistantRun`: an array of steps (`reasoning`, `tool`, `text`, `sources`, `actions`, `suggestions`). Replace it with a call to your agent API that streams the same step shapes; `AiProvider` consumes steps incrementally and the panel, insights cards and approval queue keep working. Agent definitions, proposals, activity and runs in `lib/ai/agents.ts` map directly onto an agents service; `lib/ai/guardrails.ts` (`redactPii`, `toolCategoryFor`) is the client-side policy the assistant applies before sending. Keep `lib/ai/assistant.test.ts` meaningful by pointing starter prompts and templates at scenarios your backend handles.

## The model catalog

Already live. `lib/ai/openrouter.server.ts` fetches OpenRouter with a one-hour revalidation. To use a private gateway, change `OPENROUTER_MODELS_URL` and adapt `normalizeModel` to the response; keep `CatalogModel` so the facets, table and detail sheet are untouched.
