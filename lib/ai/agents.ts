import { daysAgo, hoursAgo } from "@/lib/data/seed"

export type Autonomy = "suggest" | "approve" | "autonomous"

export interface AiAgent {
  id: string
  name: string
  description: string
  module: "ITSM" | "ITOM" | "AgentOps" | "Knowledge" | "Change"
  autonomy: Autonomy
  enabled: boolean
  tools: string[]
  trigger: string
  runs24h: number
  actions24h: number
  acceptanceRate: number
  avgSavedMinutes: number
  lastRun: string
  health: "Healthy" | "Degraded" | "Paused"
}

export const agents: AiAgent[] = [
  {
    id: "triage",
    name: "Incident Triage",
    description:
      "Classifies new incidents, sets impact and urgency, picks the assignment group and links the affected CI.",
    module: "ITSM",
    autonomy: "autonomous",
    enabled: true,
    tools: [
      "read_incident",
      "search_services",
      "update_incident",
      "search_knowledge",
    ],
    trigger: "On incident created",
    runs24h: 142,
    actions24h: 131,
    acceptanceRate: 96,
    avgSavedMinutes: 4,
    lastRun: hoursAgo(0.1),
    health: "Healthy",
  },
  {
    id: "correlate",
    name: "Alert Correlation",
    description:
      "Groups related monitoring alerts, suppresses noise and proposes a single incident with the probable root CI.",
    module: "ITOM",
    autonomy: "approve",
    enabled: true,
    tools: ["read_alerts", "search_services", "create_incident", "close_alert"],
    trigger: "Every 60 seconds",
    runs24h: 1440,
    actions24h: 38,
    acceptanceRate: 91,
    avgSavedMinutes: 12,
    lastRun: hoursAgo(0.02),
    health: "Healthy",
  },
  {
    id: "risk",
    name: "Change Risk Assessor",
    description:
      "Scores change risk from service blast radius, open incidents, past failures and schedule conflicts. Drafts CAB notes.",
    module: "Change",
    autonomy: "suggest",
    enabled: true,
    tools: [
      "read_change",
      "search_services",
      "read_incidents",
      "read_change_history",
    ],
    trigger: "On change moved to Assess",
    runs24h: 9,
    actions24h: 9,
    acceptanceRate: 88,
    avgSavedMinutes: 25,
    lastRun: hoursAgo(2.5),
    health: "Healthy",
  },
  {
    id: "kb",
    name: "Knowledge Curator",
    description:
      "Turns resolved incidents into draft articles, flags stale content and merges duplicates.",
    module: "Knowledge",
    autonomy: "approve",
    enabled: true,
    tools: [
      "read_incident",
      "search_knowledge",
      "create_article",
      "retire_article",
    ],
    trigger: "On incident resolved",
    runs24h: 27,
    actions24h: 6,
    acceptanceRate: 74,
    avgSavedMinutes: 35,
    lastRun: hoursAgo(1.2),
    health: "Healthy",
  },
  {
    id: "prompt-hygiene",
    name: "Prompt Hygiene",
    description:
      "Flags stale prompt versions, prompts that drifted from their golden set and agents running behind the approved version.",
    module: "AgentOps",
    autonomy: "approve",
    enabled: true,
    tools: [
      "read_agent",
      "read_prompt_versions",
      "run_golden_set",
      "retire_prompt_version",
    ],
    trigger: "Nightly and on prompt publish",
    runs24h: 8,
    actions24h: 3,
    acceptanceRate: 89,
    avgSavedMinutes: 20,
    lastRun: hoursAgo(0.6),
    health: "Healthy",
  },
  {
    id: "cost-guardian",
    name: "Cost Guardian",
    description:
      "Watches spend per agent against budget and proposes model downgrades or intent routing where quality holds.",
    module: "AgentOps",
    autonomy: "suggest",
    enabled: true,
    tools: ["read_agent_metrics", "read_experiments", "propose_model_change"],
    trigger: "Hourly",
    runs24h: 24,
    actions24h: 2,
    acceptanceRate: 78,
    avgSavedMinutes: 30,
    lastRun: hoursAgo(0.4),
    health: "Healthy",
  },
  {
    id: "eval-sentinel",
    name: "Eval Regression Sentinel",
    description:
      "Runs evaluators on sampled traces, compares against each agent's baseline and opens drift signals on regressions.",
    module: "AgentOps",
    autonomy: "autonomous",
    enabled: true,
    tools: ["read_traces", "run_evaluators", "open_drift_signal"],
    trigger: "Every 15 minutes",
    runs24h: 96,
    actions24h: 5,
    acceptanceRate: 92,
    avgSavedMinutes: 25,
    lastRun: hoursAgo(0.2),
    health: "Degraded",
  },
  {
    id: "tool-auditor",
    name: "Tool Permission Auditor",
    description:
      "Reviews which tools each agent actually calls, flags unused write scopes and proposes least-privilege changes.",
    module: "AgentOps",
    autonomy: "approve",
    enabled: true,
    tools: ["read_agent", "read_traces", "update_tool_permissions"],
    trigger: "Weekly and on new tool grant",
    runs24h: 2,
    actions24h: 1,
    acceptanceRate: 85,
    avgSavedMinutes: 15,
    lastRun: hoursAgo(3),
    health: "Healthy",
  },
  {
    id: "comms",
    name: "Major Incident Comms",
    description:
      "Drafts stakeholder updates on a cadence during major incidents using bridge notes and timeline.",
    module: "ITSM",
    autonomy: "approve",
    enabled: false,
    tools: ["read_incident", "read_work_notes", "send_notification"],
    trigger: "Every 30 min during P1",
    runs24h: 0,
    actions24h: 0,
    acceptanceRate: 90,
    avgSavedMinutes: 15,
    lastRun: daysAgo(3),
    health: "Paused",
  },
]

export interface AgentProposal {
  id: string
  agentId: string
  recordNumber: string
  recordHref: string
  action: string
  rationale: string
  confidence: number
  created: string
  impact: "low" | "medium" | "high"
  diff?: { field: string; from: string; to: string }[]
}

export const proposals: AgentProposal[] = [
  {
    id: "p1",
    agentId: "correlate",
    recordNumber: "ALT0060004",
    recordHref: "/itom/alerts",
    action: "Create incident from 3 correlated alerts on sw-core-east-01",
    rationale:
      "PSU failure, CRC errors and link flaps on the same core switch within 6 minutes. Pattern matches 2 prior incidents (INC0010016, INC0010063).",
    confidence: 0.93,
    created: hoursAgo(0.3),
    impact: "high",
  },
  {
    id: "p2",
    agentId: "kb",
    recordNumber: "INC0010069",
    recordHref: "/itsm/incidents/INC0010069",
    action: "Publish draft article “Windows update loop on reboot — fix”",
    rationale:
      "Resolved 4 times this month with the same fix. No existing article covers it. Draft generated from resolution notes.",
    confidence: 0.81,
    created: hoursAgo(1.1),
    impact: "low",
  },
  {
    id: "p3",
    agentId: "cost-guardian",
    recordNumber: "agt-support-triage",
    recordHref: "/agentops/recommendations",
    action: "Route simple intents on Support Triage to Claude Haiku 5.5",
    rationale:
      "61% of Support Triage traffic is password, access and status intents. Shadow evals on Haiku 5.5 match quality within 0.4 points at 39% lower cost — about $2.4K/month.",
    confidence: 0.82,
    created: hoursAgo(1.8),
    impact: "medium",
    diff: [
      {
        field: "Router",
        from: "Sonnet 5.5 for all intents",
        to: "Haiku 5.5 for simple intents",
      },
      { field: "Cost / day", from: "$96", to: "$58 (est.)" },
    ],
  },
  {
    id: "p4",
    agentId: "risk",
    recordNumber: "CHG0031104",
    recordHref: "/itsm/changes/CHG0031104",
    action: "Raise risk from Moderate to High and require CAB review",
    rationale:
      "Node group scale touches eks-prod-east, which hosts 3 tier-1 services with 1 open P1. Similar changes failed 1 of 4 times.",
    confidence: 0.77,
    created: hoursAgo(2.4),
    impact: "medium",
    diff: [
      { field: "Risk", from: "Moderate", to: "High" },
      { field: "CAB required", from: "No", to: "Yes" },
    ],
  },
  {
    id: "p5",
    agentId: "prompt-hygiene",
    recordNumber: "agt-it-helpdesk",
    recordHref: "/agentops/agents/agt-it-helpdesk",
    action: "Retire prompt p-27 on IT Helpdesk Copilot and pin p-30",
    rationale:
      "p-27 is three versions behind the approved prompt and scores 6 points lower on the helpdesk golden set. It is also the version live during the current topic-mix drift.",
    confidence: 0.9,
    created: hoursAgo(5),
    impact: "medium",
    diff: [{ field: "Prompt version", from: "p-27", to: "p-30" }],
  },
  {
    id: "p6",
    agentId: "tool-auditor",
    recordNumber: "agt-alert-correlator",
    recordHref: "/agentops/agents/agt-alert-correlator",
    action: "Revoke unused create_incident scope from Alert Correlator",
    rationale:
      "The scope has not been called in 30 days; incidents are created via the approval flow instead. Removing it shrinks the blast radius of a bad run.",
    confidence: 0.84,
    created: hoursAgo(6.5),
    impact: "low",
    diff: [{ field: "Tools", from: "3 (1 write)", to: "2 (read only)" }],
  },
]

export interface AgentActivity {
  id: string
  agentId: string
  summary: string
  recordNumber?: string
  recordHref?: string
  outcome:
    "applied" | "approved" | "rejected" | "suggested" | "failed" | "undone"
  timestamp: string
  actor?: string
}

export const agentActivity: AgentActivity[] = [
  {
    id: "a1",
    agentId: "triage",
    summary:
      "Set priority P4, assigned to Network Operations, linked CI wifi-ctrl-hq-01",
    recordNumber: "INC0010048",
    recordHref: "/itsm/incidents/INC0010048",
    outcome: "applied",
    timestamp: hoursAgo(0.1),
  },
  {
    id: "a2",
    agentId: "prompt-hygiene",
    summary:
      "Flagged prompt p-27 on IT Helpdesk Copilot as stale · 3 versions behind p-30",
    recordNumber: "agt-it-helpdesk",
    recordHref: "/agentops/agents/agt-it-helpdesk",
    outcome: "suggested",
    timestamp: hoursAgo(0.6),
  },
  {
    id: "a3",
    agentId: "correlate",
    summary:
      "Created INC0010078 from 2 Payments API alerts and paged Site Reliability",
    recordNumber: "INC0010078",
    recordHref: "/itsm/incidents/INC0010078",
    outcome: "approved",
    timestamp: hoursAgo(0.8),
    actor: "Arjun Mehta",
  },
  {
    id: "a4",
    agentId: "triage",
    summary:
      "Reclassified Hardware → Network (VPN) and reassigned to Network Operations",
    recordNumber: "INC0010056",
    recordHref: "/itsm/incidents/INC0010056",
    outcome: "applied",
    timestamp: hoursAgo(1.4),
  },
  {
    id: "a5",
    agentId: "risk",
    summary:
      "Suggested adding backout validation step; accepted by change owner",
    recordNumber: "CHG0031101",
    recordHref: "/itsm/changes/CHG0031101",
    outcome: "approved",
    timestamp: hoursAgo(2.5),
    actor: "Lars Eriksen",
  },
  {
    id: "a6",
    agentId: "kb",
    summary:
      "Proposed merging two VPN articles — rejected as content differs by OS",
    recordNumber: "KB0010231",
    recordHref: "/itsm/knowledge/KB0010231",
    outcome: "rejected",
    timestamp: hoursAgo(3.2),
    actor: "Amara Okafor",
  },
  {
    id: "a7",
    agentId: "eval-sentinel",
    summary:
      "Golden-set run on Change Risk Advisor aborted: 6.1% tool errors on search_services",
    recordNumber: "drf-004",
    recordHref: "/agentops/drift",
    outcome: "failed",
    timestamp: hoursAgo(4.1),
  },
  {
    id: "a8",
    agentId: "triage",
    summary:
      "Set P2 on a how-to inquiry — reverted by agent after caller clarified",
    recordNumber: "INC0010011",
    recordHref: "/itsm/incidents/INC0010011",
    outcome: "undone",
    timestamp: hoursAgo(9),
    actor: "Mateo García",
  },
  {
    id: "a9",
    agentId: "correlate",
    summary: "Suppressed 212 duplicate CloudWatch events into 3 alerts",
    outcome: "applied",
    timestamp: hoursAgo(12),
  },
]

export type AgentRunOutcome =
  "succeeded" | "needs-approval" | "failed" | "skipped"

export interface AgentRun {
  id: string
  agentId: string
  startedAt: string
  durationMs: number
  outcome: AgentRunOutcome
  trigger: string
  summary: string
  recordNumber?: string
  recordHref?: string
  toolCalls: number
  tokens: number
}

/** Recent individual agent runs — one row per invocation, newest first. */
export const agentRuns: AgentRun[] = [
  {
    id: "r1",
    agentId: "correlate",
    startedAt: hoursAgo(0.02),
    durationMs: 1840,
    outcome: "needs-approval",
    trigger: "Schedule",
    summary: "3 alerts on sw-core-east-01 correlated; incident proposed",
    recordNumber: "ALT0060004",
    recordHref: "/itom/alerts",
    toolCalls: 4,
    tokens: 6210,
  },
  {
    id: "r2",
    agentId: "triage",
    startedAt: hoursAgo(0.1),
    durationMs: 2310,
    outcome: "succeeded",
    trigger: "Incident created",
    summary:
      "Classified as Network › Wi-Fi, set P4, assigned Network Operations",
    recordNumber: "INC0010048",
    recordHref: "/itsm/incidents/INC0010048",
    toolCalls: 3,
    tokens: 4120,
  },
  {
    id: "r3",
    agentId: "correlate",
    startedAt: hoursAgo(0.3),
    durationMs: 1420,
    outcome: "skipped",
    trigger: "Schedule",
    summary: "No new alert groups above threshold",
    toolCalls: 1,
    tokens: 880,
  },
  {
    id: "r4",
    agentId: "cost-guardian",
    startedAt: hoursAgo(0.6),
    durationMs: 1960,
    outcome: "needs-approval",
    trigger: "Schedule",
    summary: "Support Triage at 61% simple intents; Haiku routing proposed",
    recordNumber: "agt-support-triage",
    recordHref: "/agentops/agents/agt-support-triage",
    toolCalls: 3,
    tokens: 3470,
  },
  {
    id: "r5",
    agentId: "correlate",
    startedAt: hoursAgo(0.8),
    durationMs: 2780,
    outcome: "succeeded",
    trigger: "Schedule",
    summary:
      "Created INC0010078 from 2 Payments API alerts; paged Site Reliability",
    recordNumber: "INC0010078",
    recordHref: "/itsm/incidents/INC0010078",
    toolCalls: 5,
    tokens: 7930,
  },
  {
    id: "r6",
    agentId: "kb",
    startedAt: hoursAgo(1.1),
    durationMs: 6420,
    outcome: "needs-approval",
    trigger: "Incident resolved",
    summary: "Drafted article from 4 matching resolutions",
    recordNumber: "INC0010069",
    recordHref: "/itsm/incidents/INC0010069",
    toolCalls: 6,
    tokens: 14880,
  },
  {
    id: "r7",
    agentId: "triage",
    startedAt: hoursAgo(1.4),
    durationMs: 2050,
    outcome: "succeeded",
    trigger: "Incident created",
    summary:
      "Reclassified Hardware → Network (VPN); reassigned to Network Operations",
    recordNumber: "INC0010056",
    recordHref: "/itsm/incidents/INC0010056",
    toolCalls: 3,
    tokens: 3890,
  },
  {
    id: "r8",
    agentId: "prompt-hygiene",
    startedAt: hoursAgo(1.8),
    durationMs: 9100,
    outcome: "needs-approval",
    trigger: "Nightly prompt review",
    summary:
      "p-27 on IT Helpdesk Copilot 3 versions behind; retirement proposed",
    recordNumber: "agt-it-helpdesk",
    recordHref: "/agentops/agents/agt-it-helpdesk",
    toolCalls: 7,
    tokens: 11250,
  },
  {
    id: "r9",
    agentId: "risk",
    startedAt: hoursAgo(2.4),
    durationMs: 5230,
    outcome: "needs-approval",
    trigger: "Change moved to Assess",
    summary: "Scored CHG0031104 as High; CAB review recommended",
    recordNumber: "CHG0031104",
    recordHref: "/itsm/changes/CHG0031104",
    toolCalls: 4,
    tokens: 9640,
  },
  {
    id: "r13",
    agentId: "tool-auditor",
    startedAt: hoursAgo(3),
    durationMs: 4800,
    outcome: "needs-approval",
    trigger: "Weekly audit",
    summary:
      "create_incident unused for 30 days on Alert Correlator; revoke proposed",
    recordNumber: "agt-alert-correlator",
    recordHref: "/agentops/agents/agt-alert-correlator",
    toolCalls: 4,
    tokens: 6020,
  },
  {
    id: "r10",
    agentId: "eval-sentinel",
    startedAt: hoursAgo(4.1),
    durationMs: 12400,
    outcome: "failed",
    trigger: "Schedule",
    summary:
      "Golden-set run on Change Risk Advisor aborted after 6.1% tool errors",
    recordNumber: "drf-004",
    recordHref: "/agentops/drift",
    toolCalls: 2,
    tokens: 1560,
  },
  {
    id: "r11",
    agentId: "kb",
    startedAt: hoursAgo(5),
    durationMs: 3300,
    outcome: "needs-approval",
    trigger: "Weekly review",
    summary: "Flagged stale article referencing retired CI",
    recordNumber: "KB0010122",
    recordHref: "/itsm/knowledge/KB0010122",
    toolCalls: 3,
    tokens: 5110,
  },
  {
    id: "r12",
    agentId: "correlate",
    startedAt: hoursAgo(12),
    durationMs: 3900,
    outcome: "succeeded",
    trigger: "Schedule",
    summary: "Suppressed 212 duplicate CloudWatch events into 3 alerts",
    toolCalls: 2,
    tokens: 4480,
  },
]

export const runOutcomeMeta: Record<
  AgentRunOutcome,
  { label: string; state: string }
> = {
  succeeded: { label: "Succeeded", state: "Complete" },
  "needs-approval": { label: "Needs approval", state: "Pending Approval" },
  failed: { label: "Failed", state: "Failed" },
  skipped: { label: "Skipped", state: "Canceled" },
}

/** Actions per day for the last week, split by how they were authorized. */
export const usageByDay = [
  { name: "Thu", applied: 162, approved: 31, rejected: 6 },
  { name: "Fri", applied: 171, approved: 28, rejected: 4 },
  { name: "Sat", applied: 88, approved: 9, rejected: 1 },
  { name: "Sun", applied: 74, approved: 7, rejected: 2 },
  { name: "Mon", applied: 198, approved: 36, rejected: 9 },
  { name: "Tue", applied: 205, approved: 40, rejected: 7 },
  { name: "Wed", applied: 227, approved: 44, rejected: 5 },
]

export type ModelProvider =
  "anthropic" | "openai" | "google" | "deepseek" | "xai" | "mistral" | "meta"

export interface AiModel {
  id: string
  name: string
  provider: ModelProvider
  tier: "fast" | "balanced" | "reasoning"
  /** One line shown under the name in pickers. */
  description: string
  /** Context window in thousands of tokens. */
  contextK: number
  /** Matching OpenRouter model id, used to deep-link into the catalog. */
  openRouterId?: string
}

export const providerMeta: Record<
  ModelProvider,
  { label: string; logo: string }
> = {
  anthropic: { label: "Anthropic", logo: "anthropic" },
  openai: { label: "OpenAI", logo: "openai" },
  google: { label: "Google", logo: "google" },
  deepseek: { label: "DeepSeek", logo: "deepseek" },
  xai: { label: "xAI", logo: "xai" },
  mistral: { label: "Mistral", logo: "mistral" },
  meta: { label: "Meta", logo: "llama" },
}

export const tierMeta: Record<
  AiModel["tier"],
  { label: string; hint: string }
> = {
  reasoning: {
    label: "Reasoning",
    hint: "Deliberate, multi-step thinking for hard problems",
  },
  balanced: {
    label: "Balanced",
    hint: "Strong quality at everyday latency and cost",
  },
  fast: {
    label: "Fast",
    hint: "Low latency for routing, classification and summaries",
  },
}

/**
 * Curated models offered in AgentOps Assist. The full market is browsable on
 * /ai/models (live from OpenRouter); anything there can be pinned into this
 * list from the catalog.
 */
export const models: AiModel[] = [
  {
    id: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    provider: "anthropic",
    tier: "reasoning",
    description: "Highest quality for triage, root-cause analysis and drafting",
    contextK: 1000,
    openRouterId: "anthropic/claude-fable-5.1",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "anthropic",
    tier: "balanced",
    description: "Default for agents and chat; best quality per dollar",
    contextK: 1000,
    openRouterId: "anthropic/claude-sonnet-5.5",
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "anthropic",
    tier: "fast",
    description: "Classification, routing and summaries at volume",
    contextK: 200,
    openRouterId: "anthropic/claude-haiku-5.5",
  },
  {
    id: "gpt-5-5",
    name: "GPT-5.5",
    provider: "openai",
    tier: "reasoning",
    description: "Frontier reasoning with strong coding and tool use",
    contextK: 400,
    openRouterId: "openai/gpt-5.5",
  },
  {
    id: "gpt-5-4-mini",
    name: "GPT-5.4 mini",
    provider: "openai",
    tier: "fast",
    description: "Cost-efficient model for high-volume, well-defined tasks",
    contextK: 400,
    openRouterId: "openai/gpt-5.4-mini",
  },
  {
    id: "gemini-3-1-pro",
    name: "Gemini 3.1 Pro",
    provider: "google",
    tier: "reasoning",
    description: "Long-context analysis across documents, images and video",
    contextK: 1000,
    openRouterId: "google/gemini-3.1-pro-preview",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    tier: "fast",
    description: "Very fast multimodal model for interactive workloads",
    contextK: 1000,
    openRouterId: "google/gemini-3-flash-preview",
  },
  {
    id: "deepseek-v3-2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    tier: "balanced",
    description:
      "Open-weight generalist with strong value for internal tooling",
    contextK: 164,
    openRouterId: "deepseek/deepseek-v3.2",
  },
  {
    id: "grok-4-7",
    name: "Grok 4.7",
    provider: "xai",
    tier: "balanced",
    description: "Agentic tool calling with a very large context window",
    contextK: 2000,
    openRouterId: "x-ai/grok-4.7",
  },
]

export function getModel(id: string) {
  return models.find((m) => m.id === id)
}

export const toolCatalog = [
  {
    id: "read_records",
    label: "Read records",
    description: "Incidents, changes, requests, agents, traces",
    risk: "low",
  },
  {
    id: "search_knowledge",
    label: "Search knowledge",
    description: "Articles, known errors and policies",
    risk: "low",
  },
  {
    id: "update_fields",
    label: "Update fields",
    description: "Priority, assignment, categorization",
    risk: "medium",
  },
  {
    id: "create_records",
    label: "Create records",
    description: "Incidents, problems, draft articles",
    risk: "medium",
  },
  {
    id: "change_agent_config",
    label: "Change agent config",
    description: "Model, prompt version and tool permissions",
    risk: "high",
  },
  {
    id: "send_notifications",
    label: "Send notifications",
    description: "Email, chat and status page updates",
    risk: "high",
  },
  {
    id: "close_records",
    label: "Close or retire",
    description: "Close alerts, resolve incidents, retire prompt versions",
    risk: "high",
  },
] as const

export function getAgent(id: string) {
  return agents.find((a) => a.id === id)
}

export const autonomyMeta: Record<
  Autonomy,
  { label: string; description: string }
> = {
  suggest: {
    label: "Suggest",
    description: "Agent drafts recommendations; a person applies them.",
  },
  approve: {
    label: "Act with approval",
    description:
      "Agent prepares the action and waits for a one-click approval.",
  },
  autonomous: {
    label: "Autonomous",
    description: "Agent acts immediately and logs every change for review.",
  },
}
