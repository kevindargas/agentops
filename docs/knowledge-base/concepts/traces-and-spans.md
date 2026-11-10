# Traces and spans

A trace is one run of one agent. A span is one step inside that run. Together they are the unit of truth for everything else in Agent Operations: review items point at traces, drift signals are computed from them, evals compare against them, releases are judged by them.

## The trace record

`AgentTrace` in `lib/types.ts` carries:

| Field | Meaning |
| --- | --- |
| `id`, `agentId`, `startedAt`, `durationMs` | Identity and timing. Ids start with `tr_`. |
| `status` | Review-workflow state: Succeeded, Failed, Needs review, Reviewed. |
| `outcome` | What actually happened. See below. |
| `boundHit` | Which run limit ended the run, if one did: `max_steps`, `deadline`, `cost_budget`, `no_progress`. |
| `channel`, `sessionId` | Web, Slack, Teams, API or Email, and the conversation the run belongs to. |
| `userQuery`, `finalAnswer` | The user's input and the agent's final text. |
| `tokensIn`, `tokensOut`, `cost`, `modelId`, `version` | Usage and the deployed version that served the run. |
| `userFeedback` | `up` or `down` when the user voted. |
| `evals` | Evaluator scores 0 to 1 for `grounded`, `helpful`, `safe`. |
| `flags` | Markers from the `traceFlags` tuple (`TraceFlag`): Low confidence, Hallucination risk, Missing citation, Policy: PII, Tool error, Long latency. The flag facet is built from the tuple. |
| `spans` | The step list. |
| `lineage` | Reproducibility: code SHA, prompt version, params hash, index build id, tool schema versions, policy version. |
| `streaming` | For streamed channels: time to first token, tokens per second, disconnected, truncated. |
| `experimentId`, `variant` | Set when the run was part of an A/B test. |

## Status versus outcome

`status` is about the review workflow. `outcome` is about the run.

| Outcome | Meaning | Counts as "ok" |
| --- | --- | --- |
| `completed` | Full answer delivered | yes |
| `partial` | Answer delivered but a step was skipped or truncated | yes |
| `refused` | The agent declined (policy, scope) | yes |
| `invalid_output` | Output failed schema or format validation | no |
| `tool_error` | A tool call failed and the run could not recover | no |
| `timeout` | Deadline or per-request timeout hit | no |
| `rate_limited` | Provider returned 429 and retries were exhausted | no |
| `abandoned` | The client went away before the run finished | no |

A `refused` run can be a success for a safety policy and a failure for the user; keep the two axes separate when you report. The Fleet Overview "Outcomes, 24h" card counts anything other than `completed` in its hint.

## Spans

`TraceSpan` has a `type` matching the agent graph node types: router, llm, retriever, tool, human, guard, chain. Each span has a start offset in milliseconds from trace start, a duration, a status (ok, error, skipped) and, for LLM spans, `finishReason` (stop, length, tool_calls, content_filter, error), `requestedModelId` and `responseModelId`. When the two model ids differ, an alias was resolved by the provider or a fallback route served the call; the trace waterfall highlights this.

Spans also carry `tokensIn`, `tokensOut`, `cost`, `input`, `output` and `attributes`. The field names were chosen so an OpenTelemetry GenAI exporter can fill them without translation (`gen_ai.usage.*`, `gen_ai.request.model`, `gen_ai.response.model`).

## The waterfall

The trace record page (`/agentops/traces/[id]`) renders spans as a waterfall ordered by `startMs`, grouped under their `parentId`. Click a span to see its input, output and attributes. The bar colours follow `nodeMeta` in `features/agentops/shared.tsx`: LLM is brand, retriever is chart-3, tool is chart-2, human is warning, guard is success.

## Where traces feed

- **Review Queue**: `ReviewItem.traceId`. Sampled by `reviewRate`, or flagged by evaluator, thumbs-down, low confidence or policy match.
- **Drift & Quality**: quality signals are evaluator scores aggregated per agent over time.
- **Guardrails**: every violation links to the trace where it fired.
- **Evals**: eval cases may carry a `traceId` when a case came from production.
- **Experiments**: traces with `experimentId` and `variant` are the raw material of per-variant metrics.
- **Audit Log**: context may carry `traceId` so that a configuration change can be tied to the run that motivated it.

## Operating notes

- Trust traces only when the telemetry pipeline is healthy. Fleet Overview shows trace coverage, dropped span rate, export failures and ingestion lag; above 60 seconds of lag the card warns that traces may be behind live traffic. The Traces page quotes `telemetryHealth.sampleRate` (100 percent in the sample).
- The list is deep-linkable: `?agent=`, `?status=`, `?outcome=`, `?flag=` preselect facets, `?version=` narrows to one agent build and `?policy=` to runs where a given guardrail fired.
- `lineage.paramsHash` and `lineage.promptVersion` let you answer "what exactly ran" without reading configuration pages. When a trace looks wrong, compare its lineage with the current release on the Deployments environments matrix.
