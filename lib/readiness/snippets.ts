import type { SnippetDef } from "./types"

export const snippets: SnippetDef[] = [
  {
    id: "otel-span-python",
    title: "LLM call span (Python, OTel GenAI semconv)",
    language: "python",
    description:
      "Minimum attribute set for a chat completion span. Pair with gen_ai.client.* metrics for dashboards.",
    code: `from opentelemetry import trace

tracer = trace.get_tracer("agentops")

with tracer.start_as_current_span("chat claude-fable-5-1") as span:
    span.set_attribute("gen_ai.operation.name", "chat")
    span.set_attribute("gen_ai.provider.name", "anthropic")
    span.set_attribute("gen_ai.request.model", "claude-fable-5-1")
    span.set_attribute("gen_ai.request.temperature", 0.2)
    span.set_attribute("gen_ai.request.max_tokens", 1024)
    span.set_attribute("gen_ai.conversation.id", session_id)
    span.set_attribute("agentops.agent.id", "agt-support-triage")
    span.set_attribute("agentops.prompt.version", "p-12")

    resp = client.messages.create(**request)

    span.set_attribute("gen_ai.response.model", resp.model)
    span.set_attribute("gen_ai.response.finish_reasons", [resp.stop_reason])
    span.set_attribute("gen_ai.usage.input_tokens", resp.usage.input_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", resp.usage.output_tokens)
`,
  },
  {
    id: "otel-span-ts",
    title: "LLM call span (TypeScript)",
    language: "typescript",
    description:
      "Same attribute set with the JS SDK; attach cost at ingest, not here.",
    code: `import { trace } from "@opentelemetry/api"

const tracer = trace.getTracer("agentops")

await tracer.startActiveSpan("chat claude-fable-5-1", async (span) => {
  span.setAttributes({
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "anthropic",
    "gen_ai.request.model": "claude-fable-5-1",
    "gen_ai.conversation.id": sessionId,
    "agentops.agent.id": "agt-support-triage",
    "agentops.prompt.version": "p-12",
  })
  try {
    const res = await client.messages.create(request)
    span.setAttributes({
      "gen_ai.response.model": res.model,
      "gen_ai.response.finish_reasons": [res.stop_reason ?? "unknown"],
      "gen_ai.usage.input_tokens": res.usage.input_tokens,
      "gen_ai.usage.output_tokens": res.usage.output_tokens,
    })
    return res
  } finally {
    span.end()
  }
})
`,
  },
  {
    id: "otel-tool-span",
    title: "Tool execution span",
    language: "python",
    description:
      "One child span per tool call. Classify side effects so dashboards can count writes.",
    code: `with tracer.start_as_current_span(f"execute_tool {tool.name}") as span:
    span.set_attribute("gen_ai.operation.name", "execute_tool")
    span.set_attribute("gen_ai.tool.name", tool.name)
    span.set_attribute("gen_ai.tool.call.id", call.id)
    span.set_attribute("agentops.tool.side_effect", tool.side_effect)  # read|write|destructive
    span.set_attribute("agentops.tool.args_hash", sha256(redact(call.args)))
    try:
        result = tool.run(**call.args)
        span.set_attribute("agentops.tool.status", "ok")
    except ToolError as e:
        span.set_attribute("agentops.tool.status", "error")
        span.record_exception(e)
        raise
`,
  },
  {
    id: "alert-rules",
    title: "Starter alert rules (Prometheus-style)",
    language: "yaml",
    description:
      "Golden-signal thresholds from the metric catalog. Tune per agent after two weeks of baseline.",
    code: `groups:
  - name: agentops-golden-signals
    rules:
      - alert: LLMErrorRateHigh
        expr: |
          sum(rate(gen_ai_client_operation_duration_count{error_type!=""}[5m])) by (agent)
          / sum(rate(gen_ai_client_operation_duration_count[5m])) by (agent) > 0.03
        for: 5m
        labels: { severity: critical }
        annotations: { runbook: "runbooks/llm-error-rate.md" }

      - alert: LLMLatencyP95High
        expr: |
          histogram_quantile(0.95,
            sum(rate(gen_ai_client_operation_duration_bucket[5m])) by (le, agent)) > 12
        for: 10m
        labels: { severity: warning }

      - alert: LLMSpendPerHourHigh
        expr: sum(increase(agentops_cost_usd_total[1h])) by (agent) > 60
        for: 0m
        labels: { severity: critical }

      - alert: GuardrailBlockRateHigh
        expr: |
          sum(rate(agentops_guardrail_decisions_total{action="block"}[15m])) by (agent)
          / sum(rate(agentops_requests_total[15m])) by (agent) > 0.05
        for: 15m
        labels: { severity: warning }

      - alert: ModelMismatch
        expr: sum(increase(agentops_model_mismatch_total[1h])) by (agent) > 0
        labels: { severity: warning }
`,
  },
  {
    id: "promptfoo-ci",
    title: "Eval gate in CI (promptfoo)",
    language: "yaml",
    description: "Fail the pipeline when any assertion drops below threshold.",
    code: `# promptfooconfig.yaml
prompts:
  - file://prompts/support-triage.p-12.txt
providers:
  - id: anthropic:messages:claude-fable-5-1
    config: { temperature: 0.2, max_tokens: 1024 }
tests: file://datasets/support-triage.v7.yaml
defaultTest:
  assert:
    - type: llm-rubric
      value: "Answer is grounded in the provided context and cites a source"
      threshold: 0.9
    - type: not-contains-any
      value: ["ignore previous instructions", "BEGIN SYSTEM PROMPT"]
outputPath: eval-results.json

# .github/workflows/evals.yml (excerpt)
# - run: npx promptfoo eval --no-cache
# - run: npx promptfoo eval --output eval-results.json && node scripts/check-thresholds.mjs
`,
  },
]

export function getSnippet(id: string) {
  return snippets.find((s) => s.id === id)
}
