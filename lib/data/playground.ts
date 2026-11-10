/**
 * Playground + agent-configuration data layer.
 *
 * Everything here is pure and deterministic: `simulateRun` seeds its rng from
 * a hash of the configuration and the input, so the same (config, input) pair
 * always yields the same transcript and metrics on server and client.
 */

import { models, type AiModel } from "@/lib/ai/agents"
import type { Autonomy } from "@/lib/ai/agents"
import type { DeployedAgent, ModelParams, ReasoningEffort } from "@/lib/types"
import { deployedAgents, getDeployedAgent } from "./agentops"
import { createRng, int, pick, type Rng } from "./seed"

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export interface PlaygroundConfig {
  agentId: string
  promptVersion: string
  /** OpenRouter-style model id, matching `DeployedAgent.modelId`. */
  modelId: string
  params: ModelParams
}

export interface RunMetrics {
  latencyMs: number
  tokensIn: number
  tokensOut: number
  /** USD. */
  cost: number
  /** 0–100 heuristic quality estimate. */
  quality: number
}

export interface SimulatedToolCall {
  name: string
  title: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  durationMs: number
}

export interface PlaygroundResult {
  /** Empty when reasoning effort is `none`. */
  reasoning: string
  tools: SimulatedToolCall[]
  /** Markdown (or a fenced JSON block when `responseFormat` is json_schema). */
  answer: string
  truncated: boolean
  metrics: RunMetrics
  /** Human-readable configuration warnings surfaced next to the metrics. */
  warnings: string[]
}

export interface PlaygroundRunRecord {
  id: string
  /** Column label when run from compare mode. */
  label?: "A" | "B"
  config: PlaygroundConfig
  input: string
  result: PlaygroundResult
}

export interface ParamDiff {
  key: keyof ModelParams
  label: string
  from: string
  to: string
}

/* ------------------------------------------------------------------------ */
/* Pricing                                                                   */
/* ------------------------------------------------------------------------ */

/** USD per 1M tokens, keyed by OpenRouter id. */
export const modelPricing: Record<string, { input: number; output: number }> = {
  "anthropic/claude-fable-5.1": { input: 15, output: 75 },
  "anthropic/claude-sonnet-5.5": { input: 3, output: 15 },
  "anthropic/claude-haiku-5.5": { input: 1, output: 5 },
  "openai/gpt-5.5": { input: 10, output: 40 },
  "openai/gpt-5.4-mini": { input: 0.4, output: 1.6 },
  "google/gemini-3.1-pro-preview": { input: 2.5, output: 15 },
  "google/gemini-3-flash-preview": { input: 0.5, output: 3 },
  "google/gemini-3.1-flash-lite": { input: 0.1, output: 0.4 },
  "deepseek/deepseek-v3.2": { input: 0.28, output: 0.42 },
  "x-ai/grok-4.7": { input: 3, output: 15 },
}

const fallbackPricing = { input: 2, output: 8 }

export function getModelPricing(modelId: string) {
  return modelPricing[modelId] ?? fallbackPricing
}

export function estimateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number
) {
  const p = getModelPricing(modelId)
  return (tokensIn * p.input + tokensOut * p.output) / 1_000_000
}

/** Curated model entry for an OpenRouter id, if it is in the picker list. */
export function getPlaygroundModel(modelId: string): AiModel | undefined {
  return models.find((m) => m.openRouterId === modelId)
}

/* ------------------------------------------------------------------------ */
/* Parameter metadata                                                        */
/* ------------------------------------------------------------------------ */

export const reasoningEffortOptions: readonly ReasoningEffort[] = [
  "none",
  "low",
  "medium",
  "high",
]

export const toolChoiceOptions: readonly ModelParams["toolChoice"][] = [
  "auto",
  "required",
  "none",
]

export interface ParamField {
  key: keyof ModelParams
  label: string
  description: string
  format: (params: ModelParams) => string
}

export const paramFields: ParamField[] = [
  {
    key: "temperature",
    label: "Temperature",
    description: "Sampling randomness. Lower is more deterministic.",
    format: (p) => p.temperature.toFixed(1),
  },
  {
    key: "topP",
    label: "Top P",
    description: "Nucleus sampling cut-off.",
    format: (p) => p.topP.toFixed(2),
  },
  {
    key: "maxOutputTokens",
    label: "Max output tokens",
    description: "Hard cap on generated tokens per response.",
    format: (p) => p.maxOutputTokens.toLocaleString("en-US"),
  },
  {
    key: "reasoningEffort",
    label: "Reasoning effort",
    description: "Thinking budget before the model answers.",
    format: (p) => p.reasoningEffort,
  },
  {
    key: "toolChoice",
    label: "Tool choice",
    description: "Whether the model may, must or must not call tools.",
    format: (p) => p.toolChoice,
  },
  {
    key: "parallelToolCalls",
    label: "Parallel tool calls",
    description: "Allow several tool calls in one turn.",
    format: (p) => (p.parallelToolCalls ? "on" : "off"),
  },
  {
    key: "responseFormat",
    label: "Response format",
    description: "Free text or JSON validated against a schema.",
    format: (p) =>
      p.responseFormat === "json_schema" ? "JSON schema" : "text",
  },
  {
    key: "stopSequences",
    label: "Stop sequences",
    description: "Generation stops when any of these appear.",
    format: (p) =>
      p.stopSequences.length ? p.stopSequences.join(", ") : "none",
  },
  {
    key: "seed",
    label: "Seed",
    description: "Fixed sampling seed for reproducible outputs.",
    format: (p) => (p.seed === undefined ? "none" : String(p.seed)),
  },
  {
    key: "timeoutMs",
    label: "Timeout",
    description: "Per-request timeout.",
    format: (p) => `${Math.round(p.timeoutMs / 1000)} s`,
  },
  {
    key: "maxToolCalls",
    label: "Max tool calls",
    description: "Agent-loop budget per run.",
    format: (p) => String(p.maxToolCalls),
  },
  {
    key: "maxRetries",
    label: "Max retries",
    description: "Retries on transient provider errors.",
    format: (p) => String(p.maxRetries),
  },
]

export function diffParams(current: ModelParams, base: ModelParams) {
  const out: ParamDiff[] = []
  for (const f of paramFields) {
    const a = f.format(current)
    const b = f.format(base)
    if (a !== b) out.push({ key: f.key, label: f.label, from: b, to: a })
  }
  return out
}

/* ------------------------------------------------------------------------ */
/* Config helpers                                                            */
/* ------------------------------------------------------------------------ */

export const defaultModelParams: ModelParams = {
  temperature: 0.3,
  topP: 0.95,
  maxOutputTokens: 2048,
  reasoningEffort: "low",
  stopSequences: [],
  toolChoice: "auto",
  parallelToolCalls: true,
  responseFormat: "text",
  timeoutMs: 60_000,
  maxToolCalls: 6,
  maxRetries: 2,
}

export function cloneParams(p: ModelParams): ModelParams {
  return { ...p, stopSequences: [...p.stopSequences] }
}

export function defaultPlaygroundConfig(
  agentId = deployedAgents[0].id
): PlaygroundConfig {
  const agent = getDeployedAgent(agentId) ?? deployedAgents[0]
  return {
    agentId: agent.id,
    promptVersion: agent.promptVersion,
    modelId: agent.modelId,
    params: cloneParams(agent.params),
  }
}

/** Deployed version plus a couple of synthetic drafts to compare against. */
export function promptVersionOptions(agent: DeployedAgent) {
  const n = Number(agent.promptVersion.replace(/\D/g, "")) || 1
  return [
    { value: agent.promptVersion, label: `${agent.promptVersion} · deployed` },
    { value: `p-${n + 1}-draft`, label: `p-${n + 1}-draft · tighter tone` },
    {
      value: `p-${n + 2}-draft`,
      label: `p-${n + 2}-draft · explicit citations`,
    },
  ]
}

/** Example JSON schema shown when response format is `json_schema`. */
export const sampleJsonSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      category: { type: "string" },
      priority: { type: "string", enum: ["P1", "P2", "P3", "P4"] },
      summary: { type: "string" },
      next_action: { type: "string" },
    },
    required: ["category", "priority", "summary"],
  },
  null,
  2
)

/* ------------------------------------------------------------------------ */
/* Share links                                                               */
/* ------------------------------------------------------------------------ */

export function configToSearchParams(config: PlaygroundConfig) {
  const p = config.params
  const sp = new URLSearchParams()
  sp.set("agent", config.agentId)
  sp.set("model", config.modelId)
  sp.set("pv", config.promptVersion)
  sp.set("temp", String(p.temperature))
  sp.set("top_p", String(p.topP))
  sp.set("max_tokens", String(p.maxOutputTokens))
  sp.set("effort", p.reasoningEffort)
  sp.set("tool_choice", p.toolChoice)
  sp.set("parallel", p.parallelToolCalls ? "1" : "0")
  sp.set("format", p.responseFormat)
  if (p.stopSequences.length) sp.set("stop", p.stopSequences.join(","))
  if (p.seed !== undefined) sp.set("seed", String(p.seed))
  sp.set("timeout", String(p.timeoutMs))
  sp.set("max_tools", String(p.maxToolCalls))
  sp.set("retries", String(p.maxRetries))
  return sp
}

function num(v: string | null, fallback: number, min?: number, max?: number) {
  if (v === null || v === "") return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  let out = n
  if (min !== undefined) out = Math.max(min, out)
  if (max !== undefined) out = Math.min(max, out)
  return out
}

function oneOf<T extends string>(
  v: string | null,
  options: readonly T[],
  fallback: T
): T {
  return v && (options as readonly string[]).includes(v) ? (v as T) : fallback
}

/** Rebuild a config from a shared URL; anything missing falls back to the agent's deployed values. */
export function configFromSearchParams(
  sp: URLSearchParams | Record<string, string | undefined>
): PlaygroundConfig {
  const get = (k: string) =>
    sp instanceof URLSearchParams ? sp.get(k) : (sp[k] ?? null)
  const agentId = get("agent") ?? deployedAgents[0].id
  const base = defaultPlaygroundConfig(agentId)
  const model = get("model")
  const d = base.params
  const stop = get("stop")
  const seed = get("seed")
  return {
    agentId: base.agentId,
    promptVersion: get("pv") ?? base.promptVersion,
    modelId: model && getPlaygroundModel(model) ? model : base.modelId,
    params: {
      temperature: num(get("temp"), d.temperature, 0, 2),
      topP: num(get("top_p"), d.topP, 0, 1),
      maxOutputTokens: num(get("max_tokens"), d.maxOutputTokens, 1, 128_000),
      reasoningEffort: oneOf(
        get("effort"),
        reasoningEffortOptions,
        d.reasoningEffort
      ),
      toolChoice: oneOf(get("tool_choice"), toolChoiceOptions, d.toolChoice),
      parallelToolCalls:
        get("parallel") === null
          ? d.parallelToolCalls
          : get("parallel") === "1",
      responseFormat: oneOf(
        get("format"),
        ["text", "json_schema"] as const,
        d.responseFormat
      ),
      stopSequences: stop ? stop.split(",").filter(Boolean) : d.stopSequences,
      seed: seed ? num(seed, 0) : d.seed,
      timeoutMs: num(get("timeout"), d.timeoutMs, 1000, 600_000),
      maxToolCalls: num(get("max_tools"), d.maxToolCalls, 0, 50),
      maxRetries: num(get("retries"), d.maxRetries, 0, 10),
    },
  }
}

/* ------------------------------------------------------------------------ */
/* Prompts & variables                                                       */
/* ------------------------------------------------------------------------ */

const VAR_RE = /\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g

/** Unique `{{variable}}` names in order of first appearance. */
export function extractVariables(prompt: string) {
  const out: string[] = []
  for (const m of prompt.matchAll(VAR_RE)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

export function renderPrompt(prompt: string, vars: Record<string, string>) {
  return prompt.replace(VAR_RE, (_, name: string) =>
    vars[name] !== undefined && vars[name] !== "" ? vars[name] : `{{${name}}}`
  )
}

interface SamplePrompt {
  text: string
  variables: Record<string, string>
}

const samplePrompts: Record<string, SamplePrompt> = {
  "agt-support-triage": {
    text: 'Customer {{customer}} ({{plan}} plan) writes:\n\n"{{message}}"\n\nClassify the conversation, pull the account context and draft a first response for the service desk.',
    variables: {
      customer: "Northwind Traders",
      plan: "Enterprise",
      message:
        "Since this morning none of our agents can log in to the portal. We get 'session expired' straight after SSO.",
    },
  },
  "agt-it-helpdesk": {
    text: 'Employee {{employee}} asks: "{{question}}"\n\nResolve it yourself where a self-service tool exists, otherwise open a ticket with the right group.',
    variables: {
      employee: "Dana Whitfield",
      question:
        "I was locked out of my laptop after too many password attempts and I need access to the finance share by 3pm.",
    },
  },
  "agt-ops-analyst": {
    text: "Answer the question using the semantic layer only. Question: {{question}}\nTime range: {{range}}",
    variables: {
      question: "Which services breached SLA most often and what was the MTTR?",
      range: "last 7 days",
    },
  },
  "agt-change-risk": {
    text: "Assess the risk of change {{change}} scheduled for {{window}}. Consider blast radius, open incidents and prior failures. Return a CAB-ready summary.",
    variables: { change: "CHG0041237", window: "Sat 08 Nov 02:00–04:00 UTC" },
  },
  "agt-hr-answers": {
    text: 'Employee in {{country}} asks: "{{question}}"\nAnswer from policy, redact anything sensitive and open a case if a decision is needed.',
    variables: {
      country: "Germany",
      question:
        "How many days of parental leave can I take and when do I need to notify my manager?",
    },
  },
  "agt-alert-correlator": {
    text: "Correlate the alert burst from {{source}} between {{from}} and {{to}}. Group related alerts, name the probable root CI and propose one incident.",
    variables: {
      source: "Datadog · payments cluster",
      from: "13:52 UTC",
      to: "13:58 UTC",
    },
  },
  "agt-kb-curator": {
    text: 'Incident {{incident}} was resolved with: "{{resolution}}"\nDraft a knowledge article, check for duplicates and tag it.',
    variables: {
      incident: "INC0048812",
      resolution:
        "Rotated the expired SAML signing certificate on the IdP and cleared the portal session cache.",
    },
  },
  "agt-finance-copilot": {
    text: "Finance question: {{question}}\nFiscal period: {{period}}. Use the semantic layer and cite the entities you queried.",
    variables: {
      question: "What is cloud spend variance vs budget by business unit?",
      period: "FY26 Q3",
    },
  },
}

export function getSamplePrompt(agentId: string): SamplePrompt {
  return (
    samplePrompts[agentId] ?? {
      text: "Summarise the situation for {{audience}}: {{context}}",
      variables: { audience: "the on-call engineer", context: "" },
    }
  )
}

/* ------------------------------------------------------------------------ */
/* Simulation                                                                */
/* ------------------------------------------------------------------------ */

/** FNV-1a 32-bit hash; stable across runtimes. */
export function hashString(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const effortTokens: Record<ReasoningEffort, number> = {
  none: 0,
  low: 140,
  medium: 460,
  high: 1200,
}

const tierMsPerToken: Record<AiModel["tier"], number> = {
  reasoning: 26,
  balanced: 16,
  fast: 8,
}

const tierBaseQuality: Record<AiModel["tier"], number> = {
  reasoning: 92,
  balanced: 88,
  fast: 82,
}

type ToolSim = (rng: Rng, input: string) => Omit<SimulatedToolCall, "name">

const toolSims: Record<string, ToolSim> = {
  search_knowledge: (rng, input) => ({
    title: "Search knowledge",
    input: { query: firstWords(input, 8), top_k: 3 },
    output: {
      results: [
        {
          id: "KB0010421",
          title: "SSO session expires immediately",
          score: 0.91,
        },
        { id: "KB0009871", title: "Portal login troubleshooting", score: 0.84 },
        { id: "KB0007712", title: "Resetting agent sessions", score: 0.77 },
      ].slice(0, int(rng, 2, 3)),
    },
    durationMs: int(rng, 180, 420),
  }),
  read_account: (rng) => ({
    title: "Read account",
    input: { account: "Northwind Traders" },
    output: {
      plan: "Enterprise",
      seats: int(rng, 120, 480),
      sso: "SAML · Okta",
      open_tickets: int(rng, 0, 3),
      health: pick(rng, ["green", "amber"]),
    },
    durationMs: int(rng, 90, 260),
  }),
  create_ticket: (rng) => ({
    title: "Create ticket",
    input: { priority: "P2", group: "Identity & Access", channel: "Web" },
    output: { number: `INC00${int(rng, 48000, 48999)}`, state: "New" },
    durationMs: int(rng, 220, 480),
  }),
  reset_password: (rng) => ({
    title: "Reset password",
    input: { user: "dana.whitfield", method: "temporary" },
    output: { ok: true, expires_in_minutes: 60, mfa_required: true },
    durationMs: int(rng, 300, 700),
  }),
  request_access: (rng) => ({
    title: "Request access",
    input: { resource: "\\\\fs01\\finance", level: "read", approver: "auto" },
    output: {
      request: `RITM00${int(rng, 7000, 7999)}`,
      state: "Pending approval",
    },
    durationMs: int(rng, 240, 520),
  }),
  semantic_lookup: (rng, input) => ({
    title: "Semantic lookup",
    input: { question: firstWords(input, 10) },
    output: {
      entities: ["sem-sla-breach", "sem-open-incident", "sem-service"],
      measures: ["breach_count", "mttr_minutes"],
      confidence: Number((0.82 + rng() * 0.15).toFixed(2)),
    },
    durationMs: int(rng, 120, 320),
  }),
  run_sql: (rng) => ({
    title: "Run SQL",
    input: {
      sql: "SELECT service, COUNT(*) AS breaches, AVG(mttr_min) AS mttr FROM sla_breach WHERE opened_at >= now() - interval '7 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 5",
      read_only: true,
    },
    output: {
      rows: [
        {
          service: "Payments API",
          breaches: int(rng, 9, 14),
          mttr: int(rng, 38, 61),
        },
        {
          service: "Identity",
          breaches: int(rng, 5, 8),
          mttr: int(rng, 22, 40),
        },
        {
          service: "Data Platform",
          breaches: int(rng, 3, 6),
          mttr: int(rng, 70, 120),
        },
      ],
      elapsed_ms: int(rng, 180, 900),
    },
    durationMs: int(rng, 400, 1400),
  }),
  render_chart: (rng) => ({
    title: "Render chart",
    input: { kind: "bar", x: "service", y: "breaches" },
    output: { asset: `chart_${int(rng, 1000, 9999)}.svg`, width: 640 },
    durationMs: int(rng, 150, 300),
  }),
  read_change: (rng) => ({
    title: "Read change",
    input: { number: "CHG0041237" },
    output: {
      type: "Normal",
      ci: "payments-db-primary",
      window: "Sat 02:00–04:00 UTC",
      cab_required: true,
      implementer: pick(rng, ["DBA team", "Platform SRE"]),
    },
    durationMs: int(rng, 80, 200),
  }),
  search_cmdb: (rng) => ({
    title: "Search CMDB",
    input: { ci: "payments-db-primary", depth: 2 },
    output: {
      dependents: int(rng, 6, 14),
      business_services: ["Checkout", "Refunds", "Billing"],
      tier: 1,
    },
    durationMs: int(rng, 150, 420),
  }),
  read_change_history: (rng) => ({
    title: "Read change history",
    input: { ci: "payments-db-primary", months: 12 },
    output: {
      changes: int(rng, 7, 15),
      failed: int(rng, 0, 2),
      last_failure: "2026-07-14",
    },
    durationMs: int(rng, 120, 380),
  }),
  read_incidents: (rng) => ({
    title: "Read incidents",
    input: { ci: "payments-db-primary", state: "open" },
    output: { open: int(rng, 0, 3), p1_last_30d: int(rng, 0, 1) },
    durationMs: int(rng, 100, 300),
  }),
  search_policies: (rng) => ({
    title: "Search policies",
    input: { topic: "parental leave", jurisdiction: "DE" },
    output: {
      policies: [
        {
          id: "POL-HR-114",
          title: "Parental leave (Germany)",
          version: "2026.2",
        },
        {
          id: "POL-HR-021",
          title: "Leave notification periods",
          version: "2025.4",
        },
      ].slice(0, int(rng, 1, 2)),
    },
    durationMs: int(rng, 140, 360),
  }),
  redact_pii: () => ({
    title: "Redact PII",
    input: { fields: ["name", "employee_id", "medical"] },
    output: { redacted: 2, categories: ["employee_id"] },
    durationMs: 40,
  }),
  open_hr_case: (rng) => ({
    title: "Open HR case",
    input: { service: "Leave & absence", confidentiality: "high" },
    output: { number: `HRC00${int(rng, 3000, 3999)}`, state: "Open" },
    durationMs: int(rng, 220, 450),
  }),
  read_alerts: (rng) => ({
    title: "Read alerts",
    input: { source: "Datadog", window_minutes: 6 },
    output: {
      alerts: int(rng, 18, 42),
      hosts: int(rng, 3, 7),
      signatures: ["cpu.high", "http.5xx", "db.connections"],
    },
    durationMs: int(rng, 120, 320),
  }),
  create_incident: (rng) => ({
    title: "Create incident",
    input: { priority: "P2", ci: "payments-db-primary", group: "Platform SRE" },
    output: {
      number: `INC00${int(rng, 48000, 48999)}`,
      alerts_linked: int(rng, 18, 42),
    },
    durationMs: int(rng, 240, 520),
  }),
  read_incident: () => ({
    title: "Read incident",
    input: { number: "INC0048812" },
    output: {
      short_description: "Portal SSO sessions expire immediately",
      ci: "idp-saml-prod",
      resolution_code: "Configuration change",
    },
    durationMs: 110,
  }),
  create_article: (rng) => ({
    title: "Create article",
    input: { title: "Portal SSO sessions expire immediately", state: "Draft" },
    output: { number: `KB00${int(rng, 10000, 10999)}`, state: "Draft" },
    durationMs: int(rng, 260, 540),
  }),
}

const genericTool: ToolSim = (rng, input) => ({
  title: "Tool call",
  input: { query: firstWords(input, 8) },
  output: { ok: true, items: int(rng, 1, 5) },
  durationMs: int(rng, 150, 400),
})

function firstWords(s: string, n: number) {
  return s.replace(/\s+/g, " ").trim().split(" ").slice(0, n).join(" ")
}

const answerTemplates: Record<string, (tools: SimulatedToolCall[]) => string> =
  {
    "agt-support-triage": (t) => {
      const ticket = findOut(t, "create_ticket", "number") ?? "a new ticket"
      return `**Classification:** Access · SSO session · *P2*\n\nThe account is on the Enterprise plan with Okta SAML. The symptom matches KB0010421 (signing certificate rotation on the IdP invalidates existing sessions).\n\n**Draft reply**\n\n> Hi — thanks for flagging this. We can see sessions for your tenant are being rejected right after SSO, which usually points to a recent certificate change on your identity provider. We've opened ${ticket} with our Identity team and will update you within 30 minutes. In the meantime, an admin can re-upload the IdP metadata under *Settings → SSO* to restore access immediately.`
    },
    "agt-it-helpdesk": (t) => {
      const ritm = findOut(t, "request_access", "request") ?? "RITM0007421"
      return `Done — here's what I did:\n\n1. **Unlocked the account** and issued a temporary password (expires in 60 min, MFA required on first login).\n2. **Requested read access** to the finance share as ${ritm}; the data owner has been notified and the request is pending approval.\n\nI did not create a ticket since both steps were self-service. Reply if the finance share isn't visible after approval.`
    },
    "agt-ops-analyst": (t) => {
      const rows = (findOut(t, "run_sql", "rows") as
        { service: string; breaches: number; mttr: number }[] | undefined) ?? [
        { service: "Payments API", breaches: 11, mttr: 48 },
        { service: "Identity", breaches: 6, mttr: 31 },
      ]
      const table = rows
        .map((r) => `| ${r.service} | ${r.breaches} | ${r.mttr} min |`)
        .join("\n")
      return `Over the last 7 days, **${rows[0].service}** breached SLA most often.\n\n| Service | Breaches | MTTR |\n| --- | ---: | ---: |\n${table}\n\nSource: \`sem-sla-breach\` joined to \`sem-service\`; MTTR is the mean of \`mttr_minutes\` per breach.`
    },
    "agt-change-risk": () =>
      `**Risk: High** (score 74/100)\n\n- **Blast radius:** tier-1 CI with 11 dependents across Checkout, Refunds and Billing.\n- **History:** 1 failed change on this CI in the last 12 months (2026-07-14).\n- **Open incidents:** none open; 1 P1 in the last 30 days.\n- **Window:** Saturday 02:00–04:00 UTC, outside the payments freeze.\n\n**CAB note:** approve with a mandatory rollback rehearsal and a 30-minute post-change validation on the Checkout synthetic.`,
    "agt-hr-answers": (t) => {
      const kase = findOut(t, "open_hr_case", "number")
      return `Under **POL-HR-114 (Parental leave, Germany)** you are entitled to up to **3 years of Elternzeit** per child, which can be split into three blocks. You must notify your manager and HR in writing **at least 7 weeks** before the leave starts (13 weeks for leave taken between the child's 3rd and 8th birthday).${kase ? `\n\nI've opened ${kase} so HR can confirm dates and pay (Elterngeld) details with you confidentially.` : ""}`
    },
    "agt-alert-correlator": (t) => {
      const inc = findOut(t, "create_incident", "number") ?? "INC0048841"
      return `Grouped **31 alerts** across 5 hosts into one episode.\n\n- **Probable root CI:** \`payments-db-primary\` — connection saturation started 90 s before downstream \`http.5xx\` on the API tier.\n- **Suppressed:** 24 duplicate \`cpu.high\` alerts from autoscaled replicas.\n\nProposed **${inc}** (P2, Platform SRE) with all alerts linked.`
    },
    "agt-kb-curator": (t) => {
      const kb = findOut(t, "create_article", "number") ?? "KB0010522"
      return `Drafted **${kb} — Portal SSO sessions expire immediately after login**.\n\n- **Symptom:** users redirected to login with "session expired" after a successful SSO.\n- **Cause:** expired SAML signing certificate on the IdP.\n- **Fix:** rotate the certificate, re-upload IdP metadata, clear the portal session cache.\n\nNo duplicate found (closest: KB0010421, 0.91 similarity — I linked it as related). Tagged \`sso\`, \`identity\`, \`portal\`.`
    },
    "agt-finance-copilot": () =>
      `Cloud spend for **FY26 Q3** is **4.2% over budget** overall.\n\n| Business unit | Actual | Budget | Variance |\n| --- | ---: | ---: | ---: |\n| Platform | $1.84M | $1.70M | +8.2% |\n| Data | $0.96M | $0.98M | −2.0% |\n| Product | $0.71M | $0.69M | +2.9% |\n\nEntities queried: \`sem-cloud-spend\`, \`sem-budget\`, \`sem-business-unit\`.`,
  }

function findOut(tools: SimulatedToolCall[], name: string, key: string) {
  const t = tools.find((x) => x.name === name)
  const v = t?.output[key]
  return v === undefined ? undefined : (v as unknown)
}

function reasoningFor(
  effort: ReasoningEffort,
  agent: DeployedAgent,
  tools: string[],
  rng: Rng
) {
  if (effort === "none") return ""
  const steps = [
    `The request maps to the ${agent.name.toLowerCase()} flow; I should ground the answer in tool results before drafting.`,
    tools.length
      ? `Plan: call ${tools.map((t) => `\`${t}\``).join(", then ")} and reconcile the outputs.`
      : "No tool calls are needed; I can answer from the prompt alone.",
    "Check for PII and anything that needs a human decision before acting.",
    `Verify the answer against the ${agent.evalDataset} rubric: cite sources, keep the tone neutral, and state the next action explicitly.`,
    pick(rng, [
      "Consider the failure mode where the account lookup returns stale data; prefer the most recent record.",
      "Weigh a conservative recommendation against the user's urgency; be explicit about trade-offs.",
      "Double-check units and time ranges before quoting numbers.",
    ]),
  ]
  const count = effort === "low" ? 1 : effort === "medium" ? 3 : 5
  return steps.slice(0, count).join("\n\n")
}

function wordsToTokens(s: string) {
  return Math.round(s.length / 4)
}

export function estimateQuality(
  config: PlaygroundConfig,
  tier: AiModel["tier"],
  truncated: boolean,
  jitter = 0
) {
  const p = config.params
  let q = tierBaseQuality[tier]
  if (p.responseFormat === "json_schema" && p.temperature > 0.7) q -= 12
  if (p.temperature > 1.2) q -= 6
  if (p.topP < 0.5) q -= 4
  if (p.reasoningEffort === "none") q -= 4
  if (
    (p.reasoningEffort === "medium" || p.reasoningEffort === "high") &&
    tier === "reasoning"
  )
    q += 3
  if (truncated) q -= 8
  const agent = getDeployedAgent(config.agentId)
  if (agent && agent.tools.length && p.toolChoice === "none") q -= 7
  if (p.maxToolCalls < 2 && agent && agent.tools.length > 1) q -= 3
  if (p.maxOutputTokens < 512) q -= 5
  return Math.max(40, Math.min(99, Math.round(q + jitter)))
}

export function configWarnings(config: PlaygroundConfig) {
  const p = config.params
  const out: string[] = []
  if (p.responseFormat === "json_schema" && p.temperature > 0.7)
    out.push("High temperature with a JSON schema raises malformed-output risk")
  if (p.temperature > 1.2) out.push("Temperature above 1.2 is rarely useful")
  if (p.toolChoice === "none")
    out.push("Tools are disabled; the agent will answer from context only")
  if (p.maxOutputTokens < 512) out.push("Low output cap may truncate answers")
  if (p.reasoningEffort === "high" && p.timeoutMs < 90_000)
    out.push("High reasoning effort with a short timeout risks timeouts")
  return out
}

/** Deterministic, scripted "run" of the agent with the given configuration. */
export function simulateRun(
  config: PlaygroundConfig,
  input: string
): PlaygroundResult {
  const agent = getDeployedAgent(config.agentId) ?? deployedAgents[0]
  const model = getPlaygroundModel(config.modelId)
  const tier = model?.tier ?? "balanced"
  const p = config.params
  const rng = createRng(
    hashString(
      JSON.stringify([
        config.agentId,
        config.modelId,
        config.promptVersion,
        p,
        input,
      ])
    )
  )

  // Tool calls
  let toolNames: string[] = []
  if (p.toolChoice !== "none" && agent.tools.length && p.maxToolCalls > 0) {
    const wanted = Math.min(
      p.maxToolCalls,
      agent.tools.length,
      p.toolChoice === "required" ? int(rng, 2, 3) : int(rng, 1, 3)
    )
    toolNames = agent.tools.slice(0, wanted)
  }
  const tools: SimulatedToolCall[] = toolNames.map((name) => ({
    name,
    ...(toolSims[name] ?? genericTool)(rng, input),
  }))

  // Transcript
  const reasoning = reasoningFor(p.reasoningEffort, agent, toolNames, rng)
  let answer = (
    answerTemplates[agent.id] ?? answerTemplates["agt-support-triage"]
  )(tools)
  if (p.temperature >= 0.9) {
    answer += pick(rng, [
      "\n\nHappy to dig deeper into any of these points!",
      "\n\nLet me know if you'd like this in a different format.",
      "\n\nAs an aside, I noticed a few related signals worth a look later.",
    ])
  }
  if (p.responseFormat === "json_schema") {
    const json = {
      category: pick(rng, ["access", "sla", "change", "hr", "incident"]),
      priority: pick(rng, ["P2", "P3"]),
      summary: firstWords(answer.replace(/[*_`>#|-]/g, ""), 28) + "…",
      next_action: tools.length
        ? `Follow up on ${tools[tools.length - 1].title.toLowerCase()}`
        : "Review and send",
      ...(p.temperature > 0.7 && rng() < 0.4
        ? { note: "free-form field not in schema" }
        : {}),
    }
    answer = "```json\n" + JSON.stringify(json, null, 2) + "\n```"
  }

  // Metrics
  const promptTokens = 820 + agent.tools.length * 160 + wordsToTokens(input)
  const toolTokens = tools.reduce(
    (acc, t) =>
      acc + wordsToTokens(JSON.stringify(t.input) + JSON.stringify(t.output)),
    0
  )
  const tokensIn = promptTokens + toolTokens + int(rng, -40, 40)
  const answerTokens = wordsToTokens(answer)
  const rawOut = answerTokens + effortTokens[p.reasoningEffort]
  const truncated = rawOut > p.maxOutputTokens
  const tokensOut = Math.min(rawOut, p.maxOutputTokens)
  if (truncated) answer += "\n\n*[output truncated at max tokens]*"

  const toolMs = tools.reduce((acc, t) => acc + t.durationMs, 0)
  const toolWall =
    p.parallelToolCalls && tools.length > 1 ? toolMs / 1.8 : toolMs
  const latencyMs = Math.round(
    380 +
      tokensOut * tierMsPerToken[tier] +
      toolWall +
      tools.length * 120 +
      (p.reasoningEffort === "high" ? 900 : 0) +
      rng() * 240
  )

  const cost = estimateCost(config.modelId, tokensIn, tokensOut)
  const quality = estimateQuality(config, tier, truncated, (rng() - 0.5) * 4)

  return {
    reasoning,
    tools,
    answer,
    truncated,
    metrics: { latencyMs, tokensIn, tokensOut, cost, quality },
    warnings: configWarnings(config),
  }
}

/* ------------------------------------------------------------------------ */
/* Agent configuration surface                                               */
/* ------------------------------------------------------------------------ */

export interface AgentOpsConfig {
  autonomy: Autonomy
  budgets: {
    /** USD per day. */
    dailyCostCap: number
    /** Spend so far this month, USD. */
    monthToDate: number
    maxTokensPerRun: number
  }
  guardrails: string[]
  knowledgeSources: string[]
  schedule: { label: string; detail: string }
}

const writeVerbs = /^(create|open|reset|request|update|close|retire)_/

const guardrailPool = [
  "PII redaction",
  "Prompt-injection filter",
  "Toxicity classifier",
  "Topic allowlist",
  "Citation required",
  "Max 3 tool retries",
]

const knowledgePools: Record<string, string[]> = {
  "Service Desk": ["Support KB", "Product docs", "Account notes"],
  "IT Operations": ["Runbooks", "CMDB snapshots", "Alert catalog"],
  "Change Management": ["Change history", "CMDB snapshots", "CAB minutes"],
  "People Ops": ["HR policy library", "Benefits FAQ"],
  Analytics: ["Semantic layer", "Metric definitions", "Finance ledger"],
}

/** Deterministic autonomy, budgets, guardrails, knowledge and schedule for an agent. */
export function getAgentOpsConfig(agentId: string): AgentOpsConfig {
  const agent = getDeployedAgent(agentId) ?? deployedAgents[0]
  const rng = createRng(hashString(`cfg:${agent.id}`))
  const writes = agent.tools.some((t) => writeVerbs.test(t))
  const autonomy: Autonomy =
    agent.environment === "staging"
      ? "suggest"
      : writes
        ? "approve"
        : "autonomous"

  const cap = Math.max(
    50,
    Math.ceil((agent.metrics.costPerDay * 1.5) / 50) * 50
  )
  const dayOfMonth = 5
  const budgets = {
    dailyCostCap: cap,
    monthToDate: Math.round(
      agent.metrics.costPerDay * dayOfMonth * (0.92 + rng() * 0.1)
    ),
    maxTokensPerRun: agent.params.maxOutputTokens * 6 + 8000,
  }

  const guardrails = [...guardrailPool]
    .sort(() => rng() - 0.5)
    .slice(0, int(rng, 2, 4))
  if (agent.tools.includes("run_sql")) guardrails.unshift("SQL read-only")
  if (
    agent.tools.includes("redact_pii") &&
    !guardrails.includes("PII redaction")
  )
    guardrails.unshift("PII redaction")

  const pool =
    knowledgePools[agent.team] ??
    (agent.tools.includes("semantic_lookup")
      ? knowledgePools.Analytics
      : knowledgePools["Service Desk"])
  const knowledgeSources = pool.slice(0, int(rng, 1, pool.length))

  const schedule = agent.tools.includes("read_alerts")
    ? { label: "Every 60 s", detail: "Polls the alert stream; skips when idle" }
    : agent.tools.includes("create_article")
      ? {
          label: "Nightly · 02:00 UTC",
          detail: "Batch over incidents resolved in the last 24 h",
        }
      : agent.tools.includes("read_change")
        ? { label: "Event-driven", detail: "On change moved to Assess" }
        : {
            label: "Event-driven",
            detail: "On conversation or request created",
          }

  return { autonomy, budgets, guardrails, knowledgeSources, schedule }
}
