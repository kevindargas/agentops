/**
 * Providers, API keys, routing and rate limits — the gateway layer between
 * deployed agents and model vendors. Deterministic mock data anchored to NOW.
 */

import { deployedAgents } from "./agentops"
import { createRng, daysAgo, daysFromNow, hoursAgo, int } from "./seed"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type ProviderStatus = "Connected" | "Degraded" | "Disconnected"
export type CredentialType =
  | "API key"
  | "Service account"
  | "IAM role"
  | "Managed identity"
  | "mTLS certificate"

export interface ProviderIncident {
  id: string
  providerId: string
  title: string
  severity: "minor" | "major"
  status: "Investigating" | "Monitoring" | "Resolved"
  started: string
}

export interface Provider {
  id: string
  name: string
  /** models.dev logo slug consumed by <ModelSelectorLogo />. */
  logo: string
  /** OpenRouter-style vendor prefix of the models served, e.g. "anthropic". */
  vendor: string
  status: ProviderStatus
  region: string
  regions: string[]
  baseUrl: string
  orgId?: string
  defaultHeaders: Record<string, string>
  /** Model ids currently enabled for routing. */
  enabledModels: string[]
  /** Everything the connection can serve, enabled or not. */
  availableModels: string[]
  credentialType: CredentialType
  requests24h: number
  /** 0–100 */
  errorRate: number
  p95Ms: number
  spendToday: number
  /** 14-day p95 latency history, ms. */
  latencyTrend: number[]
  lastHealthCheck: string
  /** Deterministic latency returned by "Test connection". */
  testLatencyMs: number
}

export type ApiKeyStatus = "Active" | "Expiring" | "Revoked" | "Rotating"
export type KeyEnvironment = "production" | "staging"

export interface ApiKey {
  id: string
  name: string
  providerId: string
  /** Masked display form, e.g. `sk-ant-…7f3a`. */
  maskedKey: string
  ownerId: string
  scopes: string[]
  environment: KeyEnvironment
  created: string
  lastUsed: string | null
  /** ISO date or null when the key never expires. */
  expires: string | null
  monthlySpend: number
  status: ApiKeyStatus
}

export type RoutingStrategy =
  | "Priority fallback"
  | "Weighted"
  | "Lowest latency"
  | "Lowest cost"
  | "Region-pinned"
export type RoutingCondition =
  "on 429" | "on 5xx" | "on timeout" | "on cost over budget"
export type RoutingStatus = "Active" | "Paused" | "Draft"

export interface RoutingTarget {
  modelId: string
  providerId: string
  /** Traffic weight for weighted strategies, 0–100. */
  weight?: number
  /** Pinned region for region-pinned strategies. */
  region?: string
}

export interface RoutingRule {
  id: string
  name: string
  description: string
  agentIds: string[]
  /** Share of gateway requests matched by this rule, 0–100. */
  trafficShare: number
  strategy: RoutingStrategy
  /** Ordered chain: primary first. */
  chain: RoutingTarget[]
  conditions: RoutingCondition[]
  timeoutMs: number
  retries: number
  fallbackHits24h: number
  status: RoutingStatus
  updated: string
}

export type RateLimitScope = "agent" | "provider" | "key"

export interface RateLimit {
  id: string
  scope: RateLimitScope
  /** Agent id, provider id or key id depending on scope. */
  targetId: string
  providerId: string
  rpm: number
  tpm: number
  concurrency: number
  usedRpm: number
  usedTpm: number
  usedConcurrency: number
  /** Extra requests allowed above RPM for short bursts. */
  burst: number
  throttled24h: number
  updated: string
}

/* -------------------------------------------------------------------------- */
/* Providers                                                                   */
/* -------------------------------------------------------------------------- */

const r = createRng(7601)

const trend = (base: number, spread: number, spike?: number) =>
  Array.from({ length: 14 }, (_, i) =>
    Math.round(
      base +
        (r() - 0.5) * spread +
        (spike !== undefined && i >= spike ? (i - spike + 1) * spread * 0.6 : 0)
    )
  )

export const providers: Provider[] = [
  {
    id: "prv-anthropic",
    name: "Anthropic",
    logo: "anthropic",
    vendor: "anthropic",
    status: "Connected",
    region: "us-east-1",
    regions: ["us-east-1", "eu-west-1"],
    baseUrl: "https://api.anthropic.com",
    orgId: "org_agentops_prod",
    defaultHeaders: {
      "anthropic-version": "2026-06-01",
      "anthropic-beta": "prompt-caching-2026-03-01",
    },
    enabledModels: [
      "anthropic/claude-fable-5.1",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-5.5",
    ],
    availableModels: [
      "anthropic/claude-fable-5.1",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-5.5",
      "anthropic/claude-opus-4.1",
    ],
    credentialType: "API key",
    requests24h: 6240,
    errorRate: 0.4,
    p95Ms: 2840,
    spendToday: 446.5,
    latencyTrend: trend(2800, 400),
    lastHealthCheck: hoursAgo(0.05),
    testLatencyMs: 312,
  },
  {
    id: "prv-openai",
    name: "OpenAI",
    logo: "openai",
    vendor: "openai",
    status: "Connected",
    region: "us-east",
    regions: ["us-east", "eu-central"],
    baseUrl: "https://api.openai.com/v1",
    orgId: "org-agentops",
    defaultHeaders: { "OpenAI-Project": "proj_agentops_gateway" },
    enabledModels: ["openai/gpt-5.5", "openai/gpt-5.4-mini"],
    availableModels: [
      "openai/gpt-5.5",
      "openai/gpt-5.4-mini",
      "openai/gpt-5.4",
      "openai/o5-mini",
    ],
    credentialType: "API key",
    requests24h: 7310,
    errorRate: 0.6,
    p95Ms: 1920,
    spendToday: 104.8,
    latencyTrend: trend(1900, 320),
    lastHealthCheck: hoursAgo(0.08),
    testLatencyMs: 268,
  },
  {
    id: "prv-vertex",
    name: "Google Vertex AI",
    logo: "google-vertex",
    vendor: "google",
    status: "Degraded",
    region: "us-central1",
    regions: ["us-central1", "europe-west4"],
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1",
    orgId: "agentops-prod-418212",
    defaultHeaders: { "x-goog-user-project": "agentops-prod-418212" },
    enabledModels: [
      "google/gemini-3.1-pro-preview",
      "google/gemini-3-flash-preview",
    ],
    availableModels: [
      "google/gemini-3.1-pro-preview",
      "google/gemini-3-flash-preview",
      "google/gemini-3-flash-lite-preview",
    ],
    credentialType: "Service account",
    requests24h: 2080,
    errorRate: 3.8,
    p95Ms: 4610,
    spendToday: 21.6,
    latencyTrend: trend(1500, 260, 11),
    lastHealthCheck: hoursAgo(0.05),
    testLatencyMs: 1480,
  },
  {
    id: "prv-bedrock",
    name: "AWS Bedrock",
    logo: "amazon-bedrock",
    vendor: "anthropic",
    status: "Connected",
    region: "us-west-2",
    regions: ["us-west-2", "eu-central-1"],
    baseUrl: "https://bedrock-runtime.us-west-2.amazonaws.com",
    defaultHeaders: {},
    enabledModels: [
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-5.5",
    ],
    availableModels: [
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-5.5",
      "amazon/nova-pro",
      "meta-llama/llama-4-maverick",
    ],
    credentialType: "IAM role",
    requests24h: 1410,
    errorRate: 0.3,
    p95Ms: 3120,
    spendToday: 64.2,
    latencyTrend: trend(3100, 380),
    lastHealthCheck: hoursAgo(0.12),
    testLatencyMs: 402,
  },
  {
    id: "prv-azure",
    name: "Azure OpenAI",
    logo: "azure",
    vendor: "openai",
    status: "Connected",
    region: "eastus2",
    regions: ["eastus2", "swedencentral"],
    baseUrl: "https://agentops-eastus2.openai.azure.com",
    orgId: "sub-7d2f…c91a",
    defaultHeaders: { "api-version": "2026-05-01" },
    enabledModels: ["openai/gpt-5.5", "openai/gpt-5.4-mini"],
    availableModels: [
      "openai/gpt-5.5",
      "openai/gpt-5.4-mini",
      "openai/o5-mini",
    ],
    credentialType: "Managed identity",
    requests24h: 960,
    errorRate: 0.2,
    p95Ms: 2210,
    spendToday: 38.9,
    latencyTrend: trend(2200, 300),
    lastHealthCheck: hoursAgo(0.1),
    testLatencyMs: 355,
  },
  {
    id: "prv-openrouter",
    name: "OpenRouter",
    logo: "openrouter",
    vendor: "openrouter",
    status: "Connected",
    region: "global",
    regions: ["global"],
    baseUrl: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://agentops.dev",
      "X-Title": "AgentOps gateway",
    },
    enabledModels: ["deepseek/deepseek-v3.2", "x-ai/grok-4.7"],
    availableModels: [
      "deepseek/deepseek-v3.2",
      "x-ai/grok-4.7",
      "qwen/qwen3-max",
      "moonshotai/kimi-k3",
      "meta-llama/llama-4-maverick",
    ],
    credentialType: "API key",
    requests24h: 1520,
    errorRate: 1.1,
    p95Ms: 2680,
    spendToday: 11.4,
    latencyTrend: trend(2600, 420),
    lastHealthCheck: hoursAgo(0.07),
    testLatencyMs: 489,
  },
  {
    id: "prv-mistral",
    name: "Mistral",
    logo: "mistral",
    vendor: "mistralai",
    status: "Connected",
    region: "eu-west",
    regions: ["eu-west"],
    baseUrl: "https://api.mistral.ai/v1",
    defaultHeaders: {},
    enabledModels: ["mistralai/mistral-large-3"],
    availableModels: [
      "mistralai/mistral-large-3",
      "mistralai/mistral-small-4",
      "mistralai/codestral-2",
    ],
    credentialType: "API key",
    requests24h: 140,
    errorRate: 0,
    p95Ms: 1640,
    spendToday: 2.1,
    latencyTrend: trend(1650, 240),
    lastHealthCheck: hoursAgo(0.2),
    testLatencyMs: 221,
  },
  {
    id: "prv-vllm",
    name: "vLLM cluster (self-hosted)",
    logo: "llama",
    vendor: "meta-llama",
    status: "Disconnected",
    region: "on-prem · dc-fra-01",
    regions: ["dc-fra-01"],
    baseUrl: "https://llm-gw.internal.agentops.dev/v1",
    defaultHeaders: { "X-Cluster": "fra-gpu-a" },
    enabledModels: ["meta-llama/llama-4-maverick", "meta-llama/llama-4-scout"],
    availableModels: [
      "meta-llama/llama-4-maverick",
      "meta-llama/llama-4-scout",
      "qwen/qwen3-32b",
    ],
    credentialType: "mTLS certificate",
    requests24h: 310,
    errorRate: 42.6,
    p95Ms: 0,
    spendToday: 0,
    latencyTrend: [...trend(880, 160).slice(0, 12), 0, 0],
    lastHealthCheck: hoursAgo(0.68),
    testLatencyMs: 0,
  },
  {
    id: "prv-cohere",
    name: "Cohere",
    logo: "cohere",
    vendor: "cohere",
    status: "Connected",
    region: "us",
    regions: ["us"],
    baseUrl: "https://api.cohere.com/v2",
    defaultHeaders: {},
    enabledModels: ["cohere/rerank-4", "cohere/embed-v4"],
    availableModels: ["cohere/rerank-4", "cohere/embed-v4", "cohere/command-a"],
    credentialType: "API key",
    requests24h: 4120,
    errorRate: 0.1,
    p95Ms: 240,
    spendToday: 6.8,
    latencyTrend: trend(240, 40),
    lastHealthCheck: hoursAgo(0.05),
    testLatencyMs: 96,
  },
]

export function getProvider(id: string) {
  return providers.find((p) => p.id === id)
}

export const providerIncidents: ProviderIncident[] = [
  {
    id: "inc-prv-001",
    providerId: "prv-vertex",
    title: "Elevated latency and 5xx on gemini-3-flash in us-central1",
    severity: "major",
    status: "Investigating",
    started: hoursAgo(1.4),
  },
  {
    id: "inc-prv-002",
    providerId: "prv-vllm",
    title: "Health check failing — GPU node pool fra-gpu-a unreachable",
    severity: "major",
    status: "Investigating",
    started: hoursAgo(0.7),
  },
  {
    id: "inc-prv-003",
    providerId: "prv-openai",
    title: "Intermittent 429s on gpt-5.5 for tier-4 organisations",
    severity: "minor",
    status: "Monitoring",
    started: hoursAgo(5.2),
  },
  {
    id: "inc-prv-004",
    providerId: "prv-anthropic",
    title: "Scheduled maintenance on eu-west-1 completed",
    severity: "minor",
    status: "Resolved",
    started: daysAgo(1.3),
  },
]

/* -------------------------------------------------------------------------- */
/* API keys                                                                    */
/* -------------------------------------------------------------------------- */

const hex = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[int(r, 0, 15)]).join("")

const keyPrefix: Record<string, string> = {
  "prv-anthropic": "sk-ant-api03-",
  "prv-openai": "sk-proj-",
  "prv-vertex": "ya29.",
  "prv-bedrock": "AKIA",
  "prv-azure": "az-",
  "prv-openrouter": "sk-or-v1-",
  "prv-mistral": "ms-",
  "prv-vllm": "vllm-",
  "prv-cohere": "co-",
}

const mask = (providerId: string) =>
  `${keyPrefix[providerId] ?? "key-"}…${hex(4)}`

const key = (
  id: string,
  name: string,
  providerId: string,
  ownerId: string,
  scopes: string[],
  environment: KeyEnvironment,
  createdDays: number,
  lastUsedHours: number | null,
  expires: string | null,
  monthlySpend: number,
  status: ApiKeyStatus
): ApiKey => ({
  id,
  name,
  providerId,
  maskedKey: mask(providerId),
  ownerId,
  scopes,
  environment,
  created: daysAgo(createdDays),
  lastUsed: lastUsedHours === null ? null : hoursAgo(lastUsedHours),
  expires,
  monthlySpend,
  status,
})

export const apiKeys: ApiKey[] = [
  key(
    "key-001",
    "gateway-prod-anthropic",
    "prv-anthropic",
    "u-001",
    ["messages", "batches", "files"],
    "production",
    212,
    0.02,
    daysFromNow(148),
    8920,
    "Active"
  ),
  key(
    "key-002",
    "gateway-prod-openai",
    "prv-openai",
    "u-001",
    ["responses", "embeddings"],
    "production",
    198,
    0.03,
    daysFromNow(9),
    2740,
    "Expiring"
  ),
  key(
    "key-003",
    "vertex-sa-hr-answers",
    "prv-vertex",
    "u-009",
    ["aiplatform.endpoints.predict"],
    "production",
    120,
    0.4,
    daysFromNow(62),
    512,
    "Active"
  ),
  key(
    "key-004",
    "bedrock-sre-role",
    "prv-bedrock",
    "u-011",
    ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "production",
    88,
    1.2,
    null,
    1860,
    "Active"
  ),
  key(
    "key-005",
    "azure-finance-copilot",
    "prv-azure",
    "u-012",
    ["chat.completions"],
    "staging",
    41,
    6.5,
    daysFromNow(321),
    140,
    "Active"
  ),
  key(
    "key-006",
    "openrouter-shared",
    "prv-openrouter",
    "u-003",
    ["chat.completions", "models.read"],
    "production",
    160,
    0.1,
    daysFromNow(3),
    318,
    "Expiring"
  ),
  key(
    "key-007",
    "openrouter-staging",
    "prv-openrouter",
    "u-003",
    ["chat.completions"],
    "staging",
    160,
    30,
    daysFromNow(190),
    24,
    "Active"
  ),
  key(
    "key-008",
    "mistral-eu-pilot",
    "prv-mistral",
    "u-005",
    ["chat.completions", "fim.completions"],
    "staging",
    27,
    14,
    daysFromNow(338),
    61,
    "Active"
  ),
  key(
    "key-009",
    "vllm-gateway-cert",
    "prv-vllm",
    "u-003",
    ["completions", "chat.completions"],
    "production",
    304,
    0.7,
    daysAgo(2),
    0,
    "Revoked"
  ),
  key(
    "key-010",
    "cohere-rerank-prod",
    "prv-cohere",
    "u-002",
    ["rerank", "embed"],
    "production",
    140,
    0.05,
    daysFromNow(225),
    204,
    "Active"
  ),
  key(
    "key-011",
    "gateway-prod-anthropic (next)",
    "prv-anthropic",
    "u-001",
    ["messages", "batches", "files"],
    "production",
    1,
    null,
    daysFromNow(366),
    0,
    "Rotating"
  ),
  key(
    "key-012",
    "evals-ci-openai",
    "prv-openai",
    "u-004",
    ["responses", "evals"],
    "staging",
    77,
    9,
    daysFromNow(103),
    388,
    "Active"
  ),
  key(
    "key-013",
    "legacy-triage-anthropic",
    "prv-anthropic",
    "u-003",
    ["messages"],
    "production",
    402,
    720,
    daysAgo(31),
    0,
    "Revoked"
  ),
  key(
    "key-014",
    "playground-openai",
    "prv-openai",
    "u-007",
    ["responses"],
    "staging",
    15,
    2.5,
    daysFromNow(76),
    47,
    "Active"
  ),
  key(
    "key-015",
    "kb-curator-bedrock",
    "prv-bedrock",
    "u-002",
    ["bedrock:InvokeModel"],
    "production",
    63,
    3.1,
    daysFromNow(12),
    410,
    "Expiring"
  ),
  key(
    "key-016",
    "ops-analyst-anthropic",
    "prv-anthropic",
    "u-001",
    ["messages", "files"],
    "production",
    95,
    0.3,
    daysFromNow(270),
    4420,
    "Active"
  ),
]

export function getApiKey(id: string) {
  return apiKeys.find((k) => k.id === id)
}

/* -------------------------------------------------------------------------- */
/* Routing rules                                                               */
/* -------------------------------------------------------------------------- */

export const routingRules: RoutingRule[] = [
  {
    id: "rt-001",
    name: "Support Triage · Sonnet with Bedrock failover",
    description:
      "Primary on Anthropic direct; fall back to the same model on Bedrock, then to Haiku when both are saturated.",
    agentIds: ["agt-support-triage"],
    trafficShare: 27,
    strategy: "Priority fallback",
    chain: [
      { modelId: "anthropic/claude-sonnet-5.5", providerId: "prv-anthropic" },
      { modelId: "anthropic/claude-sonnet-5.5", providerId: "prv-bedrock" },
      { modelId: "anthropic/claude-haiku-5.5", providerId: "prv-anthropic" },
    ],
    conditions: ["on 429", "on 5xx", "on timeout"],
    timeoutMs: 20_000,
    retries: 2,
    fallbackHits24h: 38,
    status: "Active",
    updated: daysAgo(4),
  },
  {
    id: "rt-002",
    name: "IT Helpdesk · split OpenAI / Azure",
    description:
      "Weighted split so Azure commitment is consumed while OpenAI direct carries the burst.",
    agentIds: ["agt-it-helpdesk"],
    trafficShare: 40,
    strategy: "Weighted",
    chain: [
      { modelId: "openai/gpt-5.4-mini", providerId: "prv-openai", weight: 60 },
      { modelId: "openai/gpt-5.4-mini", providerId: "prv-azure", weight: 40 },
    ],
    conditions: ["on 429", "on 5xx"],
    timeoutMs: 15_000,
    retries: 1,
    fallbackHits24h: 112,
    status: "Active",
    updated: daysAgo(9),
  },
  {
    id: "rt-003",
    name: "Ops Analyst · Fable with cost guard",
    description:
      "Deep analysis on Fable 5.1; when the Platform budget passes 90% the chain steps down to Sonnet.",
    agentIds: ["agt-ops-analyst"],
    trafficShare: 4,
    strategy: "Priority fallback",
    chain: [
      { modelId: "anthropic/claude-fable-5.1", providerId: "prv-anthropic" },
      { modelId: "anthropic/claude-sonnet-5.5", providerId: "prv-anthropic" },
    ],
    conditions: ["on cost over budget", "on 5xx"],
    timeoutMs: 60_000,
    retries: 1,
    fallbackHits24h: 6,
    status: "Active",
    updated: daysAgo(2),
  },
  {
    id: "rt-004",
    name: "HR Answers · EU region pinned",
    description:
      "Employee data must stay in the EU: Vertex europe-west4 first, Azure Sweden as the only fallback.",
    agentIds: ["agt-hr-answers"],
    trafficShare: 11,
    strategy: "Region-pinned",
    chain: [
      {
        modelId: "google/gemini-3-flash-preview",
        providerId: "prv-vertex",
        region: "europe-west4",
      },
      {
        modelId: "openai/gpt-5.4-mini",
        providerId: "prv-azure",
        region: "swedencentral",
      },
    ],
    conditions: ["on 5xx", "on timeout"],
    timeoutMs: 12_000,
    retries: 2,
    fallbackHits24h: 214,
    status: "Active",
    updated: daysAgo(16),
  },
  {
    id: "rt-005",
    name: "Alert Correlator · cheapest open-weight",
    description:
      "High-volume classification; the gateway picks the cheapest healthy target each minute.",
    agentIds: ["agt-alert-correlator"],
    trafficShare: 8,
    strategy: "Lowest cost",
    chain: [
      { modelId: "meta-llama/llama-4-scout", providerId: "prv-vllm" },
      { modelId: "deepseek/deepseek-v3.2", providerId: "prv-openrouter" },
      { modelId: "openai/gpt-5.4-mini", providerId: "prv-openai" },
    ],
    conditions: ["on 5xx", "on timeout"],
    timeoutMs: 8_000,
    retries: 1,
    fallbackHits24h: 1440,
    status: "Active",
    updated: daysAgo(1),
  },
  {
    id: "rt-006",
    name: "Change Risk · lowest latency Sonnet",
    description:
      "Interactive CAB usage; route to whichever Sonnet endpoint has the best rolling p95.",
    agentIds: ["agt-change-risk", "agt-kb-curator"],
    trafficShare: 2,
    strategy: "Lowest latency",
    chain: [
      { modelId: "anthropic/claude-sonnet-5.5", providerId: "prv-anthropic" },
      { modelId: "anthropic/claude-sonnet-5.5", providerId: "prv-bedrock" },
    ],
    conditions: ["on 429", "on timeout"],
    timeoutMs: 25_000,
    retries: 2,
    fallbackHits24h: 17,
    status: "Active",
    updated: daysAgo(21),
  },
  {
    id: "rt-007",
    name: "Finance Copilot · staging canary",
    description:
      "Staging only. GPT-5.5 on Azure with Grok as a comparison target for the eval harness.",
    agentIds: ["agt-finance-copilot"],
    trafficShare: 0,
    strategy: "Weighted",
    chain: [
      { modelId: "openai/gpt-5.5", providerId: "prv-azure", weight: 80 },
      { modelId: "x-ai/grok-4.7", providerId: "prv-openrouter", weight: 20 },
    ],
    conditions: ["on 5xx"],
    timeoutMs: 30_000,
    retries: 0,
    fallbackHits24h: 0,
    status: "Draft",
    updated: daysAgo(3),
  },
  {
    id: "rt-008",
    name: "Default · catch-all",
    description:
      "Any agent without an explicit rule lands here: Haiku first, GPT-5.4 mini second.",
    agentIds: [],
    trafficShare: 8,
    strategy: "Priority fallback",
    chain: [
      { modelId: "anthropic/claude-haiku-5.5", providerId: "prv-anthropic" },
      { modelId: "openai/gpt-5.4-mini", providerId: "prv-openai" },
    ],
    conditions: ["on 429", "on 5xx", "on timeout"],
    timeoutMs: 15_000,
    retries: 2,
    fallbackHits24h: 29,
    status: "Paused",
    updated: daysAgo(40),
  },
]

export function getRoutingRule(id: string) {
  return routingRules.find((rule) => rule.id === id)
}

/** Builds a Portkey-style gateway config object for a rule. */
export function routingRuleConfig(rule: RoutingRule) {
  const strategyMode: Record<RoutingStrategy, string> = {
    "Priority fallback": "fallback",
    Weighted: "loadbalance",
    "Lowest latency": "least-latency",
    "Lowest cost": "least-cost",
    "Region-pinned": "fallback",
  }
  const onStatusCodes = rule.conditions.flatMap((c) =>
    c === "on 429" ? [429] : c === "on 5xx" ? [500, 502, 503, 504] : []
  )
  return {
    id: rule.id,
    match: {
      agents: rule.agentIds.length ? rule.agentIds : "*",
    },
    strategy: {
      mode: strategyMode[rule.strategy],
      ...(onStatusCodes.length ? { on_status_codes: onStatusCodes } : {}),
      ...(rule.conditions.includes("on timeout")
        ? { on_timeout: true, request_timeout_ms: rule.timeoutMs }
        : {}),
      ...(rule.conditions.includes("on cost over budget")
        ? { on_budget_exceeded: true }
        : {}),
    },
    retry: { attempts: rule.retries, on_status_codes: [429, 500, 502, 503] },
    targets: rule.chain.map((t) => ({
      provider: t.providerId.replace(/^prv-/, ""),
      override_params: { model: t.modelId.split("/").pop() },
      ...(t.weight !== undefined ? { weight: t.weight / 100 } : {}),
      ...(t.region ? { region: t.region } : {}),
    })),
  }
}

/**
 * Deterministic request simulation: which target serves the request when the
 * given chain positions fail.
 */
export function simulateRoute(rule: RoutingRule, failedIndexes: number[]) {
  const steps = rule.chain.map((target, i) => {
    const provider = getProvider(target.providerId)
    const unhealthy = provider?.status === "Disconnected"
    const failed = failedIndexes.includes(i) || unhealthy
    return {
      target,
      failed,
      reason: failed
        ? unhealthy
          ? "provider disconnected"
          : rule.conditions.includes("on 429")
            ? "429 rate limited"
            : rule.conditions.includes("on 5xx")
              ? "503 upstream error"
              : "timeout"
        : null,
      latencyMs: failed
        ? Math.min(rule.timeoutMs, 1800 + i * 400)
        : (provider?.testLatencyMs ?? 400) + 900 + i * 120,
    }
  })
  const servedIndex = steps.findIndex((s) => !s.failed)
  return {
    steps: servedIndex === -1 ? steps : steps.slice(0, servedIndex + 1),
    served: servedIndex === -1 ? null : steps[servedIndex].target,
    totalLatencyMs: (servedIndex === -1
      ? steps
      : steps.slice(0, servedIndex + 1)
    ).reduce((s, step) => s + step.latencyMs, 0),
  }
}

/* -------------------------------------------------------------------------- */
/* Rate limits                                                                 */
/* -------------------------------------------------------------------------- */

const limit = (
  id: string,
  scope: RateLimitScope,
  targetId: string,
  providerId: string,
  rpm: number,
  tpm: number,
  concurrency: number,
  util: number,
  burst: number,
  throttled24h: number,
  updatedDays: number
): RateLimit => ({
  id,
  scope,
  targetId,
  providerId,
  rpm,
  tpm,
  concurrency,
  usedRpm: Math.round(rpm * util),
  usedTpm: Math.round(tpm * Math.min(1, util * (0.85 + r() * 0.3))),
  usedConcurrency: Math.min(
    concurrency,
    Math.round(concurrency * util * (0.8 + r() * 0.4))
  ),
  burst,
  throttled24h,
  updated: daysAgo(updatedDays),
})

export const rateLimits: RateLimit[] = [
  limit(
    "rl-001",
    "provider",
    "prv-anthropic",
    "prv-anthropic",
    4000,
    4_000_000,
    200,
    0.46,
    400,
    12,
    30
  ),
  limit(
    "rl-002",
    "provider",
    "prv-openai",
    "prv-openai",
    10_000,
    10_000_000,
    400,
    0.31,
    1000,
    54,
    30
  ),
  limit(
    "rl-003",
    "provider",
    "prv-vertex",
    "prv-vertex",
    1500,
    2_000_000,
    80,
    0.88,
    150,
    212,
    12
  ),
  limit(
    "rl-004",
    "provider",
    "prv-openrouter",
    "prv-openrouter",
    600,
    1_000_000,
    40,
    0.72,
    60,
    31,
    5
  ),
  limit(
    "rl-005",
    "agent",
    "agt-support-triage",
    "prv-anthropic",
    600,
    900_000,
    48,
    0.58,
    60,
    4,
    8
  ),
  limit(
    "rl-006",
    "agent",
    "agt-it-helpdesk",
    "prv-openai",
    900,
    1_200_000,
    64,
    0.64,
    90,
    18,
    8
  ),
  limit(
    "rl-007",
    "agent",
    "agt-ops-analyst",
    "prv-anthropic",
    60,
    400_000,
    8,
    0.93,
    10,
    27,
    2
  ),
  limit(
    "rl-008",
    "agent",
    "agt-hr-answers",
    "prv-vertex",
    240,
    300_000,
    24,
    0.81,
    24,
    96,
    12
  ),
  limit(
    "rl-009",
    "agent",
    "agt-alert-correlator",
    "prv-openrouter",
    120,
    250_000,
    16,
    0.97,
    12,
    388,
    1
  ),
  limit(
    "rl-010",
    "agent",
    "agt-change-risk",
    "prv-anthropic",
    40,
    150_000,
    6,
    0.22,
    8,
    0,
    21
  ),
  limit(
    "rl-011",
    "key",
    "key-006",
    "prv-openrouter",
    200,
    400_000,
    16,
    0.69,
    20,
    9,
    5
  ),
  limit(
    "rl-012",
    "key",
    "key-012",
    "prv-openai",
    300,
    600_000,
    24,
    0.12,
    50,
    0,
    40
  ),
  limit(
    "rl-013",
    "key",
    "key-001",
    "prv-anthropic",
    3000,
    3_000_000,
    160,
    0.44,
    300,
    3,
    60
  ),
]

export function getRateLimit(id: string) {
  return rateLimits.find((l) => l.id === id)
}

/** Agents that match a rule, resolved against the fleet. */
export function agentsForRule(rule: RoutingRule) {
  return rule.agentIds
    .map((id) => deployedAgents.find((a) => a.id === id))
    .filter((a): a is (typeof deployedAgents)[number] => Boolean(a))
}
