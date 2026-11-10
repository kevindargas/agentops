/**
 * Tools & MCP Servers registry: every capability an agent can call, who may
 * call it, how risky it is and how it is performing. Deterministic mock data
 * anchored to NOW (see seed.ts) so SSR and CSR agree.
 */

import type { ConnectionStatus } from "@/lib/types"
import { deployedAgents } from "./agentops"
import { createRng, daysAgo, daysFromNow, hoursAgo, int, pick } from "./seed"

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export type ToolRisk = "Read" | "Write" | "Destructive"
export type ToolApproval = "Auto" | "Require approval" | "Blocked"
export type ToolStatus = "Active" | "Deprecated" | "Disabled"
export type ToolSourceKind = "mcp" | "builtin" | "http" | "code"

export interface ToolSource {
  kind: ToolSourceKind
  /** MCP server id when `kind === "mcp"`. */
  serverId?: string
  /** Human label for http / code sources, e.g. "Identity API". */
  label?: string
}

export interface JsonSchemaProperty {
  type: "string" | "integer" | "number" | "boolean" | "array" | "object"
  description: string
  enum?: string[]
  default?: string | number | boolean
  items?: { type: string }
  format?: string
}

export interface ToolInputSchema {
  type: "object"
  properties: Record<string, JsonSchemaProperty>
  required: string[]
  additionalProperties?: boolean
}

export interface ToolError {
  at: string
  agentId: string
  message: string
}

/** Where a tool's output can end up; each sink is a distinct blast radius. */
export type ToolOutputSink =
  | "renders_html"
  | "executes_code"
  | "fetches_url"
  | "sends_message"
  | "writes_record"
  | "none"

export interface ToolIdentity {
  /** `service` runs as the platform; `delegated` acts as the requesting user. */
  mode: "service" | "delegated"
  /** Token audience (hostname / API) for delegated grants. */
  audience?: string
  scopes: string[]
  /** Lifetime of the minted token in minutes. */
  tokenTtlMin: number
}

export interface Tool {
  /** Unique snake_case name; this is what the model calls. */
  name: string
  description: string
  source: ToolSource
  risk: ToolRisk
  approval: ToolApproval
  status: ToolStatus
  ownerId: string
  /** Agents allowlisted to call the tool (derived from fleet config + extras). */
  agentIds: string[]
  calls24h: number
  /** Percent, 0 to 100. */
  errorRate: number
  p95Ms: number
  /** 14 daily call totals, oldest first. */
  calls14d: number[]
  /** Calls currently waiting in the human-approval queue. */
  pendingApprovals: number
  rateLimit: string
  timeoutMs: number
  retries: number
  inputSchema: ToolInputSchema
  outputDescription: string
  recentErrors: ToolError[]
  /** Set on deprecated tools that have a successor. */
  replacedBy?: string
  tags: string[]
  /** Calling twice with the same arguments has no further effect. */
  idempotent: boolean
  /** The tool can validate / preview a call without applying it. */
  supportsDryRun: boolean
  /** Cap per call for tools that move money or commit amounts. */
  maxTransactionUsd?: number
  /** Tool that undoes this one (may be itself, e.g. a reverse transition). */
  compensatingToolId?: string
  outputSinks: ToolOutputSink[]
  identity: ToolIdentity
}

export type McpTransport = "stdio" | "streamable-http" | "sse"
export type McpAuth = "OAuth 2.1" | "API key" | "none" | "mTLS"
export type McpStatus = ConnectionStatus

export interface McpServer {
  id: string
  name: string
  description: string
  transport: McpTransport
  /** URL for remote transports, the launch command for stdio. */
  endpoint: string
  auth: McpAuth
  status: McpStatus
  version: string
  protocolVersion: string
  toolNames: string[]
  resources: number
  prompts: number
  lastHealthCheck: string
  avgLatencyMs: number
  /** Percent, 0 to 100. */
  uptime30d: number
  agentIds: string[]
  ownerId: string
  /** Operator note shown when the server is not fully healthy. */
  note?: string
  /** sha256 prefix of the advertised tool/resource definitions. */
  definitionDigest: string
  /** When the digest last changed. */
  lastDefinitionChange: string
  /** Last time an operator signed off the definitions; unset = never. */
  reviewedAt?: string
  reviewerId?: string
  /** Server package / manifest signature verified against the publisher key. */
  signatureVerified: boolean
  /** Hostnames the server process may reach; empty = no network egress declared. */
  egressAllowlist: string[]
  /** Vendor end-of-life for the running version or transport. */
  eolDate?: string
  vulnerabilities: McpVulnerabilities
}

export interface McpVulnerabilities {
  critical: number
  high: number
  medium: number
  scannedAt: string
}

export type PermissionDecision = "allow" | "approval" | "deny"

export interface ToolPermission {
  agentId: string
  risk: ToolRisk
  decision: PermissionDecision
}

export const toolRisks: ToolRisk[] = ["Read", "Write", "Destructive"]
export const toolApprovals: ToolApproval[] = [
  "Auto",
  "Require approval",
  "Blocked",
]
export const toolStatuses: ToolStatus[] = ["Active", "Deprecated", "Disabled"]

/* ------------------------------------------------------------------------ */
/* Builders                                                                  */
/* ------------------------------------------------------------------------ */

const rng = createRng(7401)

const p = (
  type: JsonSchemaProperty["type"],
  description: string,
  extra?: Partial<JsonSchemaProperty>
): JsonSchemaProperty => ({ type, description, ...extra })

function schema(
  properties: Record<string, JsonSchemaProperty>,
  required: string[]
): ToolInputSchema {
  return { type: "object", properties, required, additionalProperties: false }
}

const mcp = (serverId: string): ToolSource => ({ kind: "mcp", serverId })
const builtin: ToolSource = { kind: "builtin" }
const http = (label: string): ToolSource => ({ kind: "http", label })
const code: ToolSource = { kind: "code", label: "Sandbox" }

const errorTemplates: Record<ToolSourceKind, string[]> = {
  mcp: [
    "JSON-RPC -32603: upstream returned 502 Bad Gateway",
    "Tool call timed out after {t}ms waiting for server response",
    "JSON-RPC -32602: missing required argument `{arg}`",
    "Rate limit exceeded (429): retry after 12s",
    "Session expired: OAuth token refresh failed (invalid_grant)",
    "Schema validation failed: `{arg}` must be a string, got null",
  ],
  builtin: [
    "Vector index shard 3 unavailable, served partial results",
    "Query exceeded 2,000 token budget and was truncated",
    "Embedding service returned 503: fallback to lexical search",
    "Argument `{arg}` failed validation: empty string",
  ],
  http: [
    "HTTP 504 from upstream after {t}ms",
    "HTTP 401: API key rotated, credential needs refresh",
    "HTTP 422: `{arg}` rejected by upstream validation",
    "Connection reset by peer (ECONNRESET)",
    "HTTP 429 rate limited: quota resets at top of hour",
  ],
  code: [
    "Sandbox killed: memory limit 512 MB exceeded",
    "Execution exceeded {t}ms wall-clock limit",
    "ModuleNotFoundError: No module named 'seaborn'",
    "Output exceeded 1 MB and was truncated",
  ],
}

interface ToolSeed {
  name: string
  description: string
  source: ToolSource
  risk: ToolRisk
  approval: ToolApproval
  status?: ToolStatus
  ownerId: string
  schema: ToolInputSchema
  output: string
  rateLimit?: string
  timeoutMs?: number
  retries?: number
  replacedBy?: string
  tags?: string[]
  /** Base daily volume; actual numbers are jittered deterministically. */
  volume: number
  errorRate?: number
  p95Ms?: number
  /** Overrides for the risk-derived side-effect / identity defaults. */
  safety?: Partial<Omit<ToolSafety, "identity">> & {
    identity?: Partial<ToolIdentity>
  }
}

type ToolSafety = Pick<
  Tool,
  | "idempotent"
  | "supportsDryRun"
  | "maxTransactionUsd"
  | "compensatingToolId"
  | "outputSinks"
  | "identity"
>

/** Remote MCP hosts tokens are minted for (stdio servers have no audience). */
const serverHosts: Record<string, string> = {
  "mcp-servicedesk": "servicedesk.internal",
  "mcp-semantic-layer": "semantic.internal",
  "mcp-github": "api.githubcopilot.com",
  "mcp-slack": "mcp.slack.com",
  "mcp-pagerduty": "mcp.pagerduty.com",
  "mcp-salesforce": "mcp.salesforce.com",
}

/** Token audience derived from where the tool actually executes. */
function audienceFor(source: ToolSource) {
  if (source.kind === "mcp") return serverHosts[source.serverId ?? ""]
  if (source.kind === "http")
    return `${(source.label ?? "api")
      .toLowerCase()
      .replace(/\s+api$/, "")
      .replace(/\s+/g, "-")}.api`
  return undefined
}

/**
 * Side-effect and identity defaults follow the risk level: reads run as the
 * platform service account and are idempotent; writes act on behalf of the
 * requesting user with short-lived tokens; destructive calls add a dry run.
 */
function safetyFor(seed: ToolSeed): ToolSafety {
  const [verb, ...rest] = seed.name.split("_")
  const resource = rest.join("_") || verb
  const base: ToolSafety =
    seed.risk === "Read"
      ? {
          idempotent: true,
          supportsDryRun: false,
          outputSinks: ["none"],
          identity: {
            mode: "service",
            scopes: [`${resource}:read`],
            tokenTtlMin: 60,
          },
        }
      : {
          idempotent: false,
          supportsDryRun: seed.risk === "Destructive",
          outputSinks: ["writes_record"],
          identity: {
            mode: "delegated",
            audience: audienceFor(seed.source),
            scopes: [`${resource}:write`],
            tokenTtlMin: seed.risk === "Destructive" ? 5 : 15,
          },
        }
  const o = seed.safety ?? {}
  return {
    ...base,
    ...o,
    identity: { ...base.identity, ...(o.identity ?? {}) },
  }
}

function buildTool(seed: ToolSeed): Tool {
  const configured = deployedAgents
    .filter((a) => a.tools.includes(seed.name))
    .map((a) => a.id)
  // The allowlist is exactly the agents whose `tools` include this tool, so
  // the tool sheet and the agent record can never disagree.
  const agentIds = configured
  const status = seed.status ?? "Active"
  const dead = status === "Disabled" || seed.approval === "Blocked"
  const base = dead
    ? 0
    : status === "Deprecated"
      ? seed.volume * 0.15
      : seed.volume
  const calls14d = Array.from({ length: 14 }, (_, i) => {
    if (!base) return 0
    const weekday = (i + 2) % 7 < 5 ? 1 : 0.55
    const drift = 1 + (i - 7) * (seed.status === "Deprecated" ? -0.04 : 0.012)
    return Math.max(
      0,
      Math.round(base * weekday * drift * (0.82 + rng() * 0.36))
    )
  })
  const calls24h = calls14d[13]
  const errorRate = base ? (seed.errorRate ?? +(rng() * 2.2).toFixed(1)) : 0
  const p95Ms = seed.p95Ms ?? int(rng, 180, 2400)
  const timeoutMs = seed.timeoutMs ?? 30_000
  const errorCount = base ? (errorRate > 2 ? 5 : errorRate > 0.8 ? 4 : 3) : 0
  const templates = errorTemplates[seed.source.kind]
  const args = Object.keys(seed.schema.properties)
  const recentErrors: ToolError[] = Array.from(
    { length: errorCount },
    (_, i) => ({
      at: hoursAgo(i * int(rng, 2, 9) + rng() * 2),
      agentId: agentIds.length ? pick(rng, agentIds) : "agt-ops-analyst",
      message: pick(rng, templates)
        .replace("{t}", String(timeoutMs))
        .replace("{arg}", args.length ? pick(rng, args) : "input"),
    })
  )
  const pendingApprovals =
    seed.approval === "Require approval" && base ? int(rng, 0, 7) : 0
  return {
    name: seed.name,
    description: seed.description,
    source: seed.source,
    risk: seed.risk,
    approval: seed.approval,
    status,
    ownerId: seed.ownerId,
    agentIds,
    calls24h,
    errorRate,
    p95Ms,
    calls14d,
    pendingApprovals,
    rateLimit: seed.rateLimit ?? "120 / min",
    timeoutMs,
    retries: seed.retries ?? 2,
    inputSchema: seed.schema,
    outputDescription: seed.output,
    recentErrors,
    replacedBy: seed.replacedBy,
    tags: seed.tags ?? [],
    ...safetyFor(seed),
  }
}

/* ------------------------------------------------------------------------ */
/* Tools                                                                     */
/* ------------------------------------------------------------------------ */

const toolSeeds: ToolSeed[] = [
  {
    name: "search_knowledge",
    description:
      "Semantic search over knowledge articles and resolved tickets. Returns ranked passages the agent can cite.",
    source: builtin,
    risk: "Read",
    approval: "Auto",
    ownerId: "u-002",
    schema: schema(
      {
        query: p("string", "Natural-language question or keywords."),
        top_k: p("integer", "Maximum passages to return.", { default: 8 }),
        space: p("string", "Corpus to search.", {
          enum: ["kb", "tickets", "all"],
          default: "all",
        }),
      },
      ["query"]
    ),
    output:
      "Array of passages with `article_id`, `title`, `score` (0-1), `excerpt` and `url`. Empty array when nothing clears the relevance floor.",
    rateLimit: "600 / min",
    timeoutMs: 8_000,
    tags: ["retrieval", "rag"],
    safety: {
      identity: { scopes: ["kb:read", "tickets:read"] },
    },
    volume: 9_800,
    errorRate: 0.3,
    p95Ms: 420,
  },
  {
    name: "read_account",
    description:
      "Fetch a customer account with plan, open cases, entitlements and health score.",
    source: mcp("mcp-salesforce"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-013",
    schema: schema(
      {
        account_id: p("string", "Salesforce account id or domain."),
        include_cases: p("boolean", "Attach open cases.", { default: true }),
      },
      ["account_id"]
    ),
    output:
      "Account object: `id`, `name`, `plan`, `arr`, `health_score`, `owner`, `open_cases[]`.",
    rateLimit: "240 / min",
    timeoutMs: 10_000,
    tags: ["crm"],
    safety: {
      identity: { scopes: ["accounts:read", "cases:read"] },
    },
    volume: 3_900,
    errorRate: 1.1,
    p95Ms: 860,
  },
  {
    name: "create_ticket",
    description:
      "Open a service desk ticket on behalf of the requester, with category and urgency.",
    source: mcp("mcp-servicedesk"),
    risk: "Write",
    approval: "Auto",
    ownerId: "u-002",
    schema: schema(
      {
        short_description: p("string", "One-line summary (≤ 160 chars)."),
        description: p("string", "Full description in Markdown."),
        category: p("string", "Service category.", {
          enum: ["hardware", "software", "access", "network", "hr", "other"],
        }),
        urgency: p("integer", "1 (high) to 3 (low).", { default: 3 }),
        requester_id: p("string", "User id of the person affected."),
      },
      ["short_description", "category", "requester_id"]
    ),
    output: "Created ticket `number`, `sys_id` and portal `url`.",
    rateLimit: "60 / min",
    timeoutMs: 15_000,
    retries: 1,
    tags: ["itsm"],
    safety: {
      idempotent: true,
      identity: { scopes: ["tickets:write"] },
    },
    volume: 1_900,
    errorRate: 0.9,
    p95Ms: 1_240,
  },
  {
    name: "semantic_lookup",
    description:
      "Resolve a business term to its governed definition, formula and synonyms in the semantic layer.",
    source: mcp("mcp-semantic-layer"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-011",
    schema: schema(
      {
        term: p("string", "Phrase to resolve, e.g. 'churned customers'."),
        domain: p("string", "Narrow to one domain.", {
          enum: ["Finance", "Sales", "Service", "People", "Any"],
          default: "Any",
        }),
      },
      ["term"]
    ),
    output:
      "Matched entity (`sem-…` id, `kind`, `definition`, `formula`, `sources[]`) plus `confidence`.",
    rateLimit: "600 / min",
    timeoutMs: 5_000,
    tags: ["semantic-layer"],
    volume: 5_400,
    errorRate: 0.2,
    p95Ms: 210,
  },
  {
    name: "run_sql",
    description:
      "Execute a read-only SQL query against the analytics warehouse. Statements are parsed and rejected if they mutate.",
    source: mcp("mcp-postgres-warehouse"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-006",
    schema: schema(
      {
        sql: p("string", "A single SELECT statement."),
        limit: p("integer", "Row cap applied server-side.", { default: 500 }),
        dry_run: p("boolean", "Explain only, do not execute.", {
          default: false,
        }),
      },
      ["sql"]
    ),
    output:
      "`columns[]`, `rows[][]`, `row_count`, `truncated` and the query `cost_ms`.",
    rateLimit: "120 / min",
    timeoutMs: 30_000,
    retries: 1,
    tags: ["analytics", "sql"],
    safety: {
      supportsDryRun: true,
      identity: { scopes: ["warehouse:select"] },
    },
    volume: 4_100,
    errorRate: 2.8,
    p95Ms: 3_600,
  },
  {
    name: "render_chart",
    description:
      "Render a Vega-Lite spec to a PNG so the answer can include a chart.",
    source: code,
    risk: "Read",
    approval: "Auto",
    ownerId: "u-010",
    schema: schema(
      {
        spec: p("object", "Vega-Lite specification."),
        width: p("integer", "Pixels.", { default: 640 }),
        theme: p("string", "Color theme.", {
          enum: ["light", "dark", "auto"],
          default: "auto",
        }),
      },
      ["spec"]
    ),
    output:
      "Signed `image_url` (24h TTL) and `alt_text` generated from the spec.",
    rateLimit: "60 / min",
    timeoutMs: 12_000,
    tags: ["visualisation"],
    safety: {
      outputSinks: ["executes_code"],
      identity: { scopes: ["sandbox:render"], tokenTtlMin: 10 },
    },
    volume: 1_300,
    errorRate: 0.7,
    p95Ms: 1_900,
  },
  {
    name: "read_change",
    description:
      "Load a change request with plan, affected CIs, approvals and risk assessment.",
    source: mcp("mcp-servicedesk"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-004",
    schema: schema({ number: p("string", "Change number, e.g. CHG0012345.") }, [
      "number",
    ]),
    output:
      "Change object with `state`, `risk`, `window`, `cis[]`, `approvals[]`, `implementation_plan`.",
    timeoutMs: 10_000,
    tags: ["itsm", "change"],
    volume: 1_150,
    errorRate: 0.4,
    p95Ms: 680,
  },
  {
    name: "search_services",
    description:
      "Find business services and CIs in the service map by name, owner or tag.",
    source: mcp("mcp-servicedesk"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-003",
    schema: schema(
      {
        query: p("string", "Service or CI name fragment."),
        class: p("string", "Restrict to a CI class.", {
          enum: ["service", "application", "server", "database", "network"],
        }),
        limit: p("integer", "Max results.", { default: 20 }),
      },
      ["query"]
    ),
    output:
      "Array of CIs: `sys_id`, `name`, `class`, `owner`, `environment`, `criticality`.",
    timeoutMs: 8_000,
    tags: ["cmdb", "service-map"],
    volume: 2_200,
    errorRate: 0.5,
    p95Ms: 540,
  },
  {
    name: "search_cmdb",
    description:
      "Deprecated alias of search_services. Kept so older prompts keep resolving; routes to the same backend.",
    source: mcp("mcp-servicedesk"),
    risk: "Read",
    approval: "Auto",
    status: "Deprecated",
    ownerId: "u-003",
    replacedBy: "search_services",
    schema: schema(
      {
        query: p("string", "CI name fragment."),
        limit: p("integer", "Max results.", { default: 20 }),
      },
      ["query"]
    ),
    output: "Same shape as `search_services`.",
    timeoutMs: 8_000,
    tags: ["cmdb", "alias"],
    volume: 2_200,
    errorRate: 0.5,
    p95Ms: 560,
  },
  {
    name: "read_change_history",
    description:
      "Past changes against the same CIs with outcomes, incidents caused and rollback history.",
    source: mcp("mcp-servicedesk"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-004",
    schema: schema(
      {
        ci_ids: p("array", "CI sys_ids to look back on.", {
          items: { type: "string" },
        }),
        window_days: p("integer", "Lookback window.", { default: 180 }),
      },
      ["ci_ids"]
    ),
    output:
      "Array of prior changes with `outcome` (success / rolled back / caused incident) and links.",
    timeoutMs: 12_000,
    tags: ["itsm", "change"],
    volume: 980,
    errorRate: 0.6,
    p95Ms: 1_120,
  },
  {
    name: "search_policies",
    description:
      "Search HR policy documents filtered by country and topic; returns the governing clause.",
    source: builtin,
    risk: "Read",
    approval: "Auto",
    ownerId: "u-007",
    schema: schema(
      {
        query: p("string", "Policy question."),
        country: p("string", "ISO-3166 country code.", { format: "iso-3166" }),
        topic: p("string", "Policy area.", {
          enum: ["leave", "benefits", "payroll", "conduct", "travel", "any"],
          default: "any",
        }),
      },
      ["query"]
    ),
    output:
      "Ranked clauses with `policy_id`, `version`, `effective_from`, `text`.",
    rateLimit: "300 / min",
    timeoutMs: 8_000,
    tags: ["retrieval", "hr"],
    volume: 2_600,
    errorRate: 0.3,
    p95Ms: 380,
  },
  {
    name: "redact_pii",
    description:
      "Mask names, ids, bank details and health data in text before it leaves the trust boundary.",
    source: builtin,
    risk: "Read",
    approval: "Auto",
    ownerId: "u-009",
    schema: schema(
      {
        text: p("string", "Text to redact."),
        entities: p("array", "Entity types to mask.", {
          items: { type: "string" },
        }),
      },
      ["text"]
    ),
    output: "`redacted_text` and `spans[]` of what was masked, by type.",
    rateLimit: "1,200 / min",
    timeoutMs: 4_000,
    retries: 0,
    tags: ["guardrail", "privacy"],
    safety: {
      identity: { scopes: ["pii:detect"] },
    },
    volume: 3_100,
    errorRate: 0.1,
    p95Ms: 160,
  },
  {
    name: "open_hr_case",
    description:
      "Open an HR case. Deprecated: use create_ticket with category `hr`, which routes through the same queue with SLAs.",
    source: mcp("mcp-servicedesk"),
    risk: "Write",
    approval: "Require approval",
    status: "Deprecated",
    ownerId: "u-007",
    replacedBy: "create_ticket",
    schema: schema(
      {
        subject: p("string", "Case subject."),
        employee_id: p("string", "Employee id."),
        confidential: p("boolean", "Restrict to HRBP visibility.", {
          default: true,
        }),
      },
      ["subject", "employee_id"]
    ),
    output: "Case `number` and `url`.",
    rateLimit: "30 / min",
    timeoutMs: 15_000,
    retries: 1,
    tags: ["hr", "alias"],
    safety: {
      identity: { scopes: ["hr_cases:write"] },
    },
    volume: 260,
    errorRate: 1.9,
    p95Ms: 1_480,
  },
  {
    name: "read_alerts",
    description:
      "List active alerts with CI, severity, correlation group and first-seen time.",
    source: http("ITOM Events API"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-005",
    schema: schema(
      {
        severity: p("array", "Severities to include.", {
          items: { type: "string" },
        }),
        since_minutes: p("integer", "Lookback.", { default: 60 }),
        ci_id: p("string", "Filter to one CI."),
      },
      []
    ),
    output:
      "Array of alerts: `id`, `severity`, `ci`, `metric`, `group_id`, `first_seen`.",
    rateLimit: "300 / min",
    timeoutMs: 6_000,
    tags: ["itom"],
    safety: {
      identity: { scopes: ["alerts:read"] },
    },
    volume: 6_200,
    errorRate: 0.8,
    p95Ms: 520,
  },
  {
    name: "create_incident",
    description:
      "Create an incident from a correlated alert group and link the affected CIs.",
    source: mcp("mcp-servicedesk"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-002",
    schema: schema(
      {
        short_description: p("string", "Summary."),
        priority: p("integer", "1-5."),
        ci_ids: p("array", "Affected CIs.", { items: { type: "string" } }),
        alert_group_id: p("string", "Correlation group to link."),
      },
      ["short_description", "priority"]
    ),
    output: "Incident `number`, `sys_id`, `url`.",
    rateLimit: "30 / min",
    timeoutMs: 15_000,
    retries: 1,
    tags: ["itsm", "incident"],
    safety: {
      idempotent: true,
      identity: { scopes: ["incidents:write", "alerts:link"] },
    },
    volume: 310,
    errorRate: 1.3,
    p95Ms: 1_380,
  },
  {
    name: "read_incident",
    description:
      "Load an incident with work notes, resolution code and linked problem.",
    source: mcp("mcp-servicedesk"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-002",
    schema: schema(
      {
        number: p("string", "Incident number, e.g. INC0045012."),
        include_notes: p("boolean", "Attach work notes.", { default: true }),
      },
      ["number"]
    ),
    output:
      "Incident object with `state`, `priority`, `resolution`, `notes[]`.",
    timeoutMs: 10_000,
    tags: ["itsm", "incident"],
    volume: 1_700,
    errorRate: 0.4,
    p95Ms: 640,
  },
  {
    name: "create_article",
    description:
      "Draft a knowledge article in the review queue. Never publishes directly.",
    source: mcp("mcp-servicedesk"),
    risk: "Write",
    approval: "Auto",
    ownerId: "u-002",
    schema: schema(
      {
        title: p("string", "Article title."),
        body_markdown: p("string", "Body in Markdown."),
        source_incidents: p("array", "Incidents the article is derived from.", {
          items: { type: "string" },
        }),
        knowledge_base: p("string", "Target KB.", {
          enum: ["IT", "HR", "Facilities"],
        }),
      },
      ["title", "body_markdown", "knowledge_base"]
    ),
    output: "Draft `kb_number` and editor `url`.",
    rateLimit: "30 / min",
    timeoutMs: 15_000,
    retries: 1,
    tags: ["knowledge"],
    safety: {
      identity: { scopes: ["kb:draft"] },
    },
    volume: 140,
    errorRate: 0.7,
    p95Ms: 1_210,
  },
  {
    name: "reset_password",
    description:
      "Trigger a password reset for a directory account after MFA verification.",
    source: http("Identity API"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-009",
    schema: schema(
      {
        user_id: p("string", "Directory user id."),
        mfa_token: p("string", "One-time code verified in chat."),
        notify: p("boolean", "Email the user.", { default: true }),
      },
      ["user_id", "mfa_token"]
    ),
    output: "`status` (sent / rejected) and `expires_at` of the reset link.",
    rateLimit: "20 / min",
    timeoutMs: 10_000,
    retries: 0,
    tags: ["identity"],
    safety: {
      outputSinks: ["writes_record", "sends_message"],
      identity: {
        scopes: ["identity:password.reset"],
        tokenTtlMin: 5,
      },
    },
    volume: 820,
    errorRate: 2.4,
    p95Ms: 1_860,
  },
  {
    name: "request_access",
    description:
      "File an access request for an application role; the role owner approves in the portal.",
    source: http("Identity API"),
    risk: "Write",
    approval: "Auto",
    ownerId: "u-009",
    schema: schema(
      {
        user_id: p("string", "Requester."),
        application: p("string", "Application name."),
        role: p("string", "Role to grant."),
        justification: p("string", "Business reason."),
      },
      ["user_id", "application", "role"]
    ),
    output: "Request `number`, `approver` and `sla_due`.",
    rateLimit: "60 / min",
    timeoutMs: 10_000,
    tags: ["identity"],
    safety: {
      idempotent: true,
      identity: { scopes: ["identity:access.request"] },
    },
    volume: 640,
    errorRate: 0.9,
    p95Ms: 1_040,
  },
  {
    name: "handoff_to_human",
    description:
      "Escalate the conversation to a human agent with a summary and the transcript. Ends the agent's turn.",
    source: builtin,
    risk: "Write",
    approval: "Auto",
    ownerId: "u-002",
    schema: schema(
      {
        reason: p("string", "Why the agent is handing off.", {
          enum: [
            "low_confidence",
            "user_requested",
            "policy",
            "sensitive_topic",
            "repeated_failure",
          ],
        }),
        summary: p("string", "Two-sentence summary for the human."),
        queue: p("string", "Target queue.", { default: "service-desk" }),
        urgency: p("integer", "1 (high) to 3 (low).", { default: 2 }),
      },
      ["reason", "summary"]
    ),
    output: "`case_id`, assigned `queue` and the estimated `wait_minutes`.",
    rateLimit: "120 / min",
    timeoutMs: 5_000,
    retries: 0,
    tags: ["escalation", "guardrail"],
    safety: {
      idempotent: true,
      outputSinks: ["sends_message"],
      identity: {
        mode: "service",
        audience: undefined,
        scopes: ["queue:enqueue"],
        tokenTtlMin: 60,
      },
    },
    volume: 460,
    errorRate: 0.2,
    p95Ms: 240,
  },
  {
    name: "send_slack_message",
    description:
      "Post a message to a Slack channel or DM. Threads to an existing message when `thread_ts` is set.",
    source: mcp("mcp-slack"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-001",
    schema: schema(
      {
        channel: p("string", "Channel id or #name."),
        text: p("string", "Message body (mrkdwn)."),
        thread_ts: p("string", "Parent message timestamp."),
      },
      ["channel", "text"]
    ),
    output: "`ts` of the posted message and `permalink`.",
    rateLimit: "60 / min",
    timeoutMs: 8_000,
    retries: 1,
    tags: ["notifications"],
    safety: {
      outputSinks: ["sends_message"],
      identity: { scopes: ["chat:write", "channels:read"] },
    },
    volume: 430,
    errorRate: 1.6,
    p95Ms: 720,
  },
  {
    name: "query_warehouse",
    description:
      "Run a saved, parameterised warehouse query by name. Safer than run_sql for recurring questions.",
    source: mcp("mcp-postgres-warehouse"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-006",
    schema: schema(
      {
        query_name: p("string", "Saved query id, e.g. `arr_by_segment`."),
        params: p("object", "Named parameters."),
      },
      ["query_name"]
    ),
    output: "`columns[]`, `rows[][]`, `row_count`, `cached` flag.",
    rateLimit: "240 / min",
    timeoutMs: 20_000,
    tags: ["analytics", "sql"],
    safety: {
      supportsDryRun: true,
      identity: { scopes: ["warehouse:select"] },
    },
    volume: 1_900,
    errorRate: 1.4,
    p95Ms: 2_300,
  },
  {
    name: "fetch_url",
    description:
      "Fetch a public URL and return readable text. Blocked for private IP ranges and intranet hosts.",
    source: mcp("mcp-browser"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-010",
    schema: schema(
      {
        url: p("string", "Absolute https URL.", { format: "uri" }),
        max_chars: p("integer", "Truncate body.", { default: 20_000 }),
      },
      ["url"]
    ),
    output: "`title`, `text`, `final_url` after redirects and `fetched_at`.",
    rateLimit: "120 / min",
    timeoutMs: 15_000,
    tags: ["web"],
    safety: {
      outputSinks: ["fetches_url", "renders_html"],
      identity: { scopes: ["egress:public"] },
    },
    volume: 560,
    errorRate: 4.2,
    p95Ms: 4_100,
  },
  {
    name: "browser_screenshot",
    description:
      "Capture a full-page screenshot of a public URL in a headless browser.",
    source: mcp("mcp-browser"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-010",
    schema: schema(
      {
        url: p("string", "Absolute https URL.", { format: "uri" }),
        viewport: p("string", "Viewport preset.", {
          enum: ["desktop", "tablet", "mobile"],
          default: "desktop",
        }),
      },
      ["url"]
    ),
    output: "Signed `image_url` (24h TTL).",
    rateLimit: "30 / min",
    timeoutMs: 20_000,
    tags: ["web"],
    safety: {
      outputSinks: ["fetches_url", "renders_html"],
      identity: { scopes: ["egress:public"] },
    },
    volume: 90,
    errorRate: 3.8,
    p95Ms: 6_200,
  },
  {
    name: "run_python",
    description:
      "Execute Python in an ephemeral sandbox with pandas and matplotlib. No network access.",
    source: code,
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-010",
    schema: schema(
      {
        code: p("string", "Python 3.12 source."),
        files: p("array", "Workspace files to mount.", {
          items: { type: "string" },
        }),
        timeout_s: p("integer", "Wall-clock limit.", { default: 60 }),
      },
      ["code"]
    ),
    output:
      "`stdout`, `stderr`, `exit_code`, `artifacts[]` written to the workspace.",
    rateLimit: "20 / min",
    timeoutMs: 60_000,
    retries: 0,
    tags: ["sandbox"],
    safety: {
      outputSinks: ["executes_code"],
      identity: {
        mode: "service",
        audience: undefined,
        scopes: ["sandbox:execute"],
        tokenTtlMin: 10,
      },
    },
    volume: 380,
    errorRate: 5.1,
    p95Ms: 8_400,
  },
  {
    name: "write_file",
    description: "Write a UTF-8 file to the agent's sandbox workspace.",
    source: mcp("mcp-filesystem-sandbox"),
    risk: "Write",
    approval: "Auto",
    ownerId: "u-010",
    schema: schema(
      {
        path: p("string", "Relative path inside /workspace."),
        content: p("string", "File contents."),
        overwrite: p("boolean", "Replace if exists.", { default: false }),
      },
      ["path", "content"]
    ),
    output: "`path`, `bytes_written`.",
    rateLimit: "300 / min",
    timeoutMs: 5_000,
    tags: ["sandbox", "files"],
    safety: {
      idempotent: true,
      identity: {
        mode: "service",
        audience: undefined,
        scopes: ["workspace:write"],
        tokenTtlMin: 10,
      },
    },
    volume: 740,
    errorRate: 0.5,
    p95Ms: 90,
  },
  {
    name: "read_file",
    description: "Read a file from the sandbox workspace.",
    source: mcp("mcp-filesystem-sandbox"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-010",
    schema: schema({ path: p("string", "Relative path inside /workspace.") }, [
      "path",
    ]),
    output: "`content` (UTF-8) and `size`.",
    rateLimit: "600 / min",
    timeoutMs: 5_000,
    tags: ["sandbox", "files"],
    safety: {
      identity: { scopes: ["workspace:read"], tokenTtlMin: 10 },
    },
    volume: 1_050,
    errorRate: 0.3,
    p95Ms: 60,
  },
  {
    name: "github_create_pr",
    description:
      "Open a pull request from a branch with title, body and reviewers.",
    source: mcp("mcp-github"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-014",
    schema: schema(
      {
        repo: p("string", "`owner/name`."),
        head: p("string", "Source branch."),
        base: p("string", "Target branch.", { default: "main" }),
        title: p("string", "PR title."),
        body: p("string", "PR description (Markdown)."),
        draft: p("boolean", "Open as draft.", { default: true }),
      },
      ["repo", "head", "title"]
    ),
    output: "`number`, `html_url`, `state`.",
    rateLimit: "30 / min",
    timeoutMs: 15_000,
    retries: 1,
    tags: ["scm"],
    safety: {
      supportsDryRun: true,
      identity: { scopes: ["repo:write", "pull_requests:write"] },
    },
    volume: 48,
    errorRate: 2.1,
    p95Ms: 1_650,
  },
  {
    name: "github_search_code",
    description: "Search code across allowed repositories.",
    source: mcp("mcp-github"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-014",
    schema: schema(
      {
        query: p("string", "GitHub code search syntax."),
        repo: p("string", "Limit to `owner/name`."),
      },
      ["query"]
    ),
    output: "Array of matches with `path`, `repo`, `fragment`, `html_url`.",
    rateLimit: "30 / min",
    timeoutMs: 10_000,
    tags: ["scm"],
    safety: {
      identity: { scopes: ["repo:read"] },
    },
    volume: 310,
    errorRate: 1.2,
    p95Ms: 980,
  },
  {
    name: "jira_transition",
    description:
      "Move a Jira issue to a new workflow status with an optional comment.",
    source: http("Jira Cloud API"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-014",
    schema: schema(
      {
        issue_key: p("string", "e.g. PLAT-1234."),
        transition: p("string", "Target status name."),
        comment: p("string", "Comment to add."),
      },
      ["issue_key", "transition"]
    ),
    output: "Updated `status` and `updated_at`.",
    rateLimit: "60 / min",
    timeoutMs: 10_000,
    retries: 1,
    tags: ["engineering"],
    safety: {
      idempotent: true,
      compensatingToolId: "jira_transition",
      identity: { scopes: ["jira:issues.transition"] },
    },
    volume: 60,
    errorRate: 1.0,
    p95Ms: 1_120,
  },
  {
    name: "pagerduty_page",
    description:
      "Page the on-call engineer for a service. Wakes people up; always behind approval.",
    source: mcp("mcp-pagerduty"),
    risk: "Destructive",
    approval: "Require approval",
    ownerId: "u-005",
    schema: schema(
      {
        service_id: p("string", "PagerDuty service id."),
        summary: p("string", "What is happening."),
        urgency: p("string", "Page urgency.", {
          enum: ["high", "low"],
          default: "high",
        }),
      },
      ["service_id", "summary"]
    ),
    output: "Incident `id`, `html_url`, `assigned_to`.",
    rateLimit: "10 / min",
    timeoutMs: 10_000,
    retries: 0,
    tags: ["on-call"],
    safety: {
      idempotent: true,
      supportsDryRun: false,
      outputSinks: ["sends_message", "writes_record"],
      identity: { scopes: ["incidents:write"] },
    },
    volume: 22,
    errorRate: 0.9,
    p95Ms: 940,
  },
  {
    name: "pagerduty_oncall",
    description: "Who is currently on call for a service or escalation policy.",
    source: mcp("mcp-pagerduty"),
    risk: "Read",
    approval: "Auto",
    ownerId: "u-005",
    schema: schema({ service_id: p("string", "PagerDuty service id.") }, [
      "service_id",
    ]),
    output: "`user`, `escalation_level`, `until`.",
    rateLimit: "120 / min",
    timeoutMs: 6_000,
    tags: ["on-call"],
    safety: {
      identity: { scopes: ["schedules:read", "oncalls:read"] },
    },
    volume: 410,
    errorRate: 0.6,
    p95Ms: 610,
  },
  {
    name: "calendar_create_event",
    description:
      "Create a calendar event and invite attendees via Google Workspace.",
    source: http("Google Workspace API"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-012",
    schema: schema(
      {
        title: p("string", "Event title."),
        start: p("string", "RFC 3339 start.", { format: "date-time" }),
        end: p("string", "RFC 3339 end.", { format: "date-time" }),
        attendees: p("array", "Email addresses.", {
          items: { type: "string" },
        }),
      },
      ["title", "start", "end"]
    ),
    output: "`event_id`, `html_link`.",
    rateLimit: "30 / min",
    timeoutMs: 8_000,
    retries: 1,
    tags: ["workspace"],
    safety: {
      outputSinks: ["writes_record", "sends_message"],
      identity: { scopes: ["calendar.events"] },
    },
    volume: 70,
    errorRate: 0.8,
    p95Ms: 890,
  },
  {
    name: "email_send",
    description:
      "Send an email from the service desk mailbox. Templates only; free-form bodies require approval.",
    source: http("Mail Relay API"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-002",
    schema: schema(
      {
        to: p("array", "Recipients.", { items: { type: "string" } }),
        template: p("string", "Template id."),
        variables: p("object", "Template variables."),
        reply_to_ticket: p("string", "Ticket number to thread under."),
      },
      ["to", "template"]
    ),
    output: "`message_id`, `queued_at`.",
    rateLimit: "60 / min",
    timeoutMs: 8_000,
    retries: 1,
    tags: ["notifications"],
    safety: {
      outputSinks: ["sends_message"],
      identity: { scopes: ["mail.send"], tokenTtlMin: 10 },
    },
    volume: 520,
    errorRate: 0.7,
    p95Ms: 760,
  },
  {
    name: "kb_publish",
    description:
      "Publish a reviewed draft article to the public portal. Irreversible for cached readers.",
    source: mcp("mcp-servicedesk"),
    risk: "Destructive",
    approval: "Require approval",
    ownerId: "u-002",
    schema: schema(
      {
        kb_number: p("string", "Draft article number."),
        audience: p("string", "Who can see it.", {
          enum: ["internal", "customers", "public"],
          default: "internal",
        }),
      },
      ["kb_number"]
    ),
    output: "`published_url`, `version`.",
    rateLimit: "10 / min",
    timeoutMs: 15_000,
    retries: 0,
    tags: ["knowledge"],
    safety: {
      idempotent: true,
      compensatingToolId: "create_article",
      identity: { scopes: ["kb:publish"] },
    },
    volume: 18,
    errorRate: 0.4,
    p95Ms: 1_320,
  },
  {
    name: "salesforce_update_opportunity",
    description: "Update stage, amount or close date on an opportunity.",
    source: mcp("mcp-salesforce"),
    risk: "Write",
    approval: "Require approval",
    ownerId: "u-013",
    schema: schema(
      {
        opportunity_id: p("string", "Opportunity id."),
        stage: p("string", "Pipeline stage."),
        amount: p("number", "Amount in account currency."),
        close_date: p("string", "ISO date.", { format: "date" }),
      },
      ["opportunity_id"]
    ),
    output: "Updated opportunity with `last_modified_by`.",
    rateLimit: "30 / min",
    timeoutMs: 10_000,
    retries: 1,
    tags: ["crm"],
    safety: {
      idempotent: true,
      maxTransactionUsd: 50_000,
      compensatingToolId: "salesforce_update_opportunity",
      identity: { scopes: ["api", "refresh_token"] },
    },
    volume: 36,
    errorRate: 1.8,
    p95Ms: 1_240,
  },
  {
    name: "delete_records",
    description:
      "Hard-delete rows from a warehouse table. Registered by the warehouse server but blocked for every agent.",
    source: mcp("mcp-postgres-warehouse"),
    risk: "Destructive",
    approval: "Blocked",
    ownerId: "u-006",
    schema: schema(
      {
        table: p("string", "Fully-qualified table."),
        where: p("string", "SQL predicate."),
      },
      ["table", "where"]
    ),
    output: "`rows_deleted`.",
    rateLimit: "0 / min",
    timeoutMs: 30_000,
    retries: 0,
    tags: ["analytics", "sql"],
    safety: {
      idempotent: true,
      identity: { scopes: ["warehouse:delete"] },
    },
    volume: 0,
  },
  {
    name: "execute_shell",
    description:
      "Run an arbitrary shell command in the sandbox. Disabled after the security review on 14 Oct.",
    source: mcp("mcp-filesystem-sandbox"),
    risk: "Destructive",
    approval: "Blocked",
    status: "Disabled",
    ownerId: "u-009",
    schema: schema(
      {
        command: p("string", "Command line."),
        cwd: p("string", "Working directory.", { default: "/workspace" }),
      },
      ["command"]
    ),
    output: "`stdout`, `stderr`, `exit_code`.",
    rateLimit: "0 / min",
    timeoutMs: 30_000,
    retries: 0,
    tags: ["sandbox"],
    safety: {
      supportsDryRun: false,
      outputSinks: ["executes_code"],
      identity: {
        mode: "service",
        audience: undefined,
        scopes: ["sandbox:shell"],
        tokenTtlMin: 5,
      },
    },
    volume: 0,
  },
]

export const tools: Tool[] = toolSeeds.map(buildTool)

/** How often the gateway polls MCP servers for health, in seconds. */
export const mcpPollIntervalSec = 30

const toolByName = new Map(tools.map((t) => [t.name, t]))

export function getTool(name: string) {
  return toolByName.get(name)
}

/** Tools an agent is allowlisted for, including deprecated aliases it still references. */
export function toolsForAgent(agentId: string) {
  return tools.filter((t) => t.agentIds.includes(agentId))
}

/* ------------------------------------------------------------------------ */
/* MCP servers                                                               */
/* ------------------------------------------------------------------------ */

interface ServerSeed {
  id: string
  name: string
  description: string
  transport: McpTransport
  endpoint: string
  auth: McpAuth
  status: McpStatus
  version: string
  protocolVersion?: string
  resources: number
  prompts: number
  lastHealthCheckHoursAgo: number
  avgLatencyMs: number
  uptime30d: number
  ownerId: string
  note?: string
  /** Days since the advertised definitions last changed. */
  definitionChangedDaysAgo: number
  /** Days since an operator reviewed them; omit for never reviewed. */
  reviewedDaysAgo?: number
  reviewerId?: string
  signatureVerified: boolean
  egressAllowlist: string[]
  /** Days until the running version / transport is end-of-life. */
  eolInDays?: number
  vulns: [critical: number, high: number, medium: number]
  scannedHoursAgo: number
}

/** 12-hex-char digest that is stable for a given id + version (FNV-1a). */
function definitionDigest(input: string) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 0x811c9dc5) >>> 0
  }
  return (
    h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
  ).slice(0, 12)
}

function buildServer(seed: ServerSeed): McpServer {
  const own = tools.filter((t) => t.source.serverId === seed.id)
  const {
    lastHealthCheckHoursAgo,
    definitionChangedDaysAgo,
    reviewedDaysAgo,
    eolInDays,
    vulns,
    scannedHoursAgo,
    ...rest
  } = seed
  return {
    ...rest,
    protocolVersion: seed.protocolVersion ?? "2025-06-18",
    toolNames: own.map((t) => t.name),
    agentIds: [...new Set(own.flatMap((t) => t.agentIds))],
    lastHealthCheck: hoursAgo(lastHealthCheckHoursAgo),
    definitionDigest: definitionDigest(`${seed.id}@${seed.version}`),
    lastDefinitionChange: daysAgo(definitionChangedDaysAgo),
    reviewedAt:
      reviewedDaysAgo === undefined ? undefined : daysAgo(reviewedDaysAgo),
    eolDate: eolInDays === undefined ? undefined : daysFromNow(eolInDays),
    vulnerabilities: {
      critical: vulns[0],
      high: vulns[1],
      medium: vulns[2],
      scannedAt: hoursAgo(scannedHoursAgo),
    },
  }
}

/** True when the definitions changed after the last operator review. */
export function serverNeedsReview(s: McpServer) {
  return !s.reviewedAt || s.lastDefinitionChange > s.reviewedAt
}

/** Code execution or HTML rendering only count as contained inside the sandbox. */
export function toolIsSandboxed(t: Tool) {
  return (
    t.source.kind === "code" || t.source.serverId === "mcp-filesystem-sandbox"
  )
}

const serverSeeds: ServerSeed[] = [
  {
    id: "mcp-servicedesk",
    name: "servicedesk",
    description:
      "Internal ITSM platform: incidents, changes, tickets, knowledge and the service map.",
    transport: "streamable-http",
    endpoint: "https://servicedesk.internal/mcp",
    auth: "mTLS",
    status: "Connected",
    version: "3.2.0",
    resources: 6,
    prompts: 5,
    lastHealthCheckHoursAgo: 0.02,
    avgLatencyMs: 340,
    uptime30d: 99.97,
    ownerId: "u-003",
    definitionChangedDaysAgo: 21,
    reviewedDaysAgo: 20,
    reviewerId: "u-003",
    signatureVerified: true,
    egressAllowlist: ["servicedesk.internal"],
    vulns: [0, 0, 1],
    scannedHoursAgo: 6,
  },
  {
    id: "mcp-semantic-layer",
    name: "internal-semantic-layer",
    description:
      "Governed metric and entity definitions served from the semantic layer catalog.",
    transport: "streamable-http",
    endpoint: "https://semantic.internal/mcp",
    auth: "mTLS",
    status: "Connected",
    version: "1.0.7",
    resources: 48,
    prompts: 2,
    lastHealthCheckHoursAgo: 0.03,
    avgLatencyMs: 120,
    uptime30d: 99.99,
    ownerId: "u-011",
    definitionChangedDaysAgo: 9,
    reviewedDaysAgo: 8,
    reviewerId: "u-011",
    signatureVerified: true,
    egressAllowlist: ["semantic.internal"],
    vulns: [0, 0, 0],
    scannedHoursAgo: 6,
  },
  {
    id: "mcp-postgres-warehouse",
    name: "postgres-warehouse",
    description:
      "Read replica of the analytics warehouse with schema resources and saved queries.",
    transport: "stdio",
    endpoint: "npx -y @modelcontextprotocol/server-postgres $WAREHOUSE_URL",
    auth: "API key",
    status: "Degraded",
    version: "0.6.2",
    resources: 12,
    prompts: 1,
    lastHealthCheckHoursAgo: 0.05,
    avgLatencyMs: 1_480,
    uptime30d: 99.4,
    ownerId: "u-006",
    definitionChangedDaysAgo: 2,
    reviewedDaysAgo: 14,
    reviewerId: "u-006",
    signatureVerified: true,
    egressAllowlist: ["warehouse-replica.internal"],
    vulns: [0, 1, 3],
    scannedHoursAgo: 12,
    note: "p95 has doubled since the replica fell 40s behind primary. Statement timeouts are being retried once.",
  },
  {
    id: "mcp-filesystem-sandbox",
    name: "filesystem-sandbox",
    description:
      "Per-session scratch workspace mounted at /workspace. Wiped when the session ends.",
    transport: "stdio",
    endpoint: "npx -y @modelcontextprotocol/server-filesystem /workspace",
    auth: "none",
    status: "Connected",
    version: "2025.8.21",
    resources: 1,
    prompts: 0,
    lastHealthCheckHoursAgo: 0.01,
    avgLatencyMs: 24,
    uptime30d: 100,
    ownerId: "u-010",
    definitionChangedDaysAgo: 40,
    reviewedDaysAgo: 38,
    reviewerId: "u-010",
    signatureVerified: true,
    egressAllowlist: [],
    vulns: [0, 0, 0],
    scannedHoursAgo: 6,
  },
  {
    id: "mcp-github",
    name: "github",
    description: "GitHub's hosted MCP server scoped to the platform org.",
    transport: "streamable-http",
    endpoint: "https://api.githubcopilot.com/mcp/",
    auth: "OAuth 2.1",
    status: "Connected",
    version: "1.8.2",
    resources: 4,
    prompts: 2,
    lastHealthCheckHoursAgo: 0.08,
    avgLatencyMs: 410,
    uptime30d: 99.9,
    ownerId: "u-014",
    definitionChangedDaysAgo: 5,
    reviewedDaysAgo: 4,
    reviewerId: "u-014",
    signatureVerified: true,
    egressAllowlist: ["api.githubcopilot.com", "api.github.com"],
    vulns: [0, 0, 2],
    scannedHoursAgo: 6,
  },
  {
    id: "mcp-slack",
    name: "slack",
    description: "Post and search messages in the AgentOps Slack workspace.",
    transport: "streamable-http",
    endpoint: "https://mcp.slack.com/v1",
    auth: "OAuth 2.1",
    status: "Connected",
    version: "0.9.4",
    resources: 2,
    prompts: 0,
    lastHealthCheckHoursAgo: 0.1,
    avgLatencyMs: 290,
    uptime30d: 99.95,
    ownerId: "u-001",
    definitionChangedDaysAgo: 1,
    reviewedDaysAgo: 30,
    reviewerId: "u-001",
    signatureVerified: true,
    egressAllowlist: ["mcp.slack.com", "slack.com", "files.slack.com"],
    vulns: [0, 0, 0],
    scannedHoursAgo: 6,
  },
  {
    id: "mcp-pagerduty",
    name: "pagerduty",
    description: "On-call schedules and incident paging.",
    transport: "sse",
    endpoint: "https://mcp.pagerduty.com/sse",
    auth: "API key",
    status: "Connected",
    version: "1.1.0",
    protocolVersion: "2024-11-05",
    resources: 3,
    prompts: 1,
    lastHealthCheckHoursAgo: 0.12,
    avgLatencyMs: 380,
    uptime30d: 99.8,
    ownerId: "u-005",
    definitionChangedDaysAgo: 60,
    reviewedDaysAgo: 55,
    reviewerId: "u-005",
    signatureVerified: true,
    egressAllowlist: ["mcp.pagerduty.com", "api.pagerduty.com"],
    eolInDays: 75,
    vulns: [0, 1, 1],
    scannedHoursAgo: 6,
    note: "Still on the legacy SSE transport; vendor migration to streamable HTTP is scheduled for Q1.",
  },
  {
    id: "mcp-browser",
    name: "browser",
    description:
      "Headless Playwright for fetching public pages and screenshots. Egress limited to the public internet.",
    transport: "stdio",
    endpoint: "npx @playwright/mcp@latest --headless",
    auth: "none",
    status: "Disconnected",
    version: "0.0.41",
    resources: 0,
    prompts: 0,
    lastHealthCheckHoursAgo: 3.2,
    avgLatencyMs: 2_900,
    uptime30d: 97.1,
    ownerId: "u-010",
    definitionChangedDaysAgo: 3,
    reviewedDaysAgo: 2,
    reviewerId: "u-010",
    signatureVerified: false,
    egressAllowlist: [],
    vulns: [1, 2, 4],
    scannedHoursAgo: 20,
    note: "Process exited with code 137 (OOM) three times in the last hour. Supervisor backoff is at 15 minutes.",
  },
  {
    id: "mcp-salesforce",
    name: "salesforce",
    description: "Accounts, cases and opportunities from the CRM.",
    transport: "streamable-http",
    endpoint: "https://mcp.salesforce.com/v1",
    auth: "OAuth 2.1",
    status: "Connected",
    version: "2.4.1",
    resources: 5,
    prompts: 3,
    lastHealthCheckHoursAgo: 0.07,
    avgLatencyMs: 620,
    uptime30d: 99.7,
    ownerId: "u-013",
    definitionChangedDaysAgo: 12,
    reviewedDaysAgo: 11,
    reviewerId: "u-013",
    signatureVerified: true,
    egressAllowlist: ["mcp.salesforce.com", "login.salesforce.com"],
    vulns: [0, 0, 1],
    scannedHoursAgo: 6,
  },
]

export const mcpServers: McpServer[] = serverSeeds.map(buildServer)

const serverById = new Map(mcpServers.map((s) => [s.id, s]))

export function getMcpServer(id: string) {
  return serverById.get(id)
}

/* ------------------------------------------------------------------------ */
/* Permissions                                                               */
/* ------------------------------------------------------------------------ */

const permissionOverrides: Record<
  string,
  Partial<Record<ToolRisk, PermissionDecision>>
> = {
  "agt-alert-correlator": { Write: "approval", Destructive: "approval" },
  "agt-kb-curator": { Destructive: "approval" },
  "agt-it-helpdesk": { Write: "approval" },
  "agt-hr-answers": { Write: "approval" },
  "agt-change-risk": { Write: "approval" },
  "agt-finance-copilot": { Write: "approval" },
}

export const toolPermissions: ToolPermission[] = deployedAgents.flatMap((a) =>
  toolRisks.map((risk) => {
    const override = permissionOverrides[a.id]?.[risk]
    const decision: PermissionDecision =
      override ??
      (risk === "Read" ? "allow" : risk === "Write" ? "allow" : "deny")
    return { agentId: a.id, risk, decision }
  })
)

export function getPermission(agentId: string, risk: ToolRisk) {
  return (
    toolPermissions.find((p) => p.agentId === agentId && p.risk === risk)
      ?.decision ?? "deny"
  )
}

/* ------------------------------------------------------------------------ */
/* Aggregates                                                                */
/* ------------------------------------------------------------------------ */

export const toolStats = (() => {
  const live = tools.filter((t) => t.status !== "Disabled")
  const calls24h = live.reduce((n, t) => n + t.calls24h, 0)
  const errors = live.reduce((n, t) => n + (t.calls24h * t.errorRate) / 100, 0)
  return {
    registered: tools.length,
    active: tools.filter((t) => t.status === "Active").length,
    calls24h,
    errorRate: calls24h ? +((errors / calls24h) * 100).toFixed(2) : 0,
    awaitingApproval: tools.reduce((n, t) => n + t.pendingApprovals, 0),
    calls14d: Array.from({ length: 14 }, (_, i) =>
      live.reduce((n, t) => n + t.calls14d[i], 0)
    ),
  }
})()
