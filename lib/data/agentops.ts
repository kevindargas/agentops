import type {
  AgentTrace,
  DeployedAgent,
  DriftSignal,
  Experiment,
  GraphNode,
  ModelRecommendation,
  Priority,
  ReviewItem,
  SemanticEntity,
  TraceSpan,
} from "@/lib/types"
import {
  chance,
  createRng,
  daysAgo,
  hoursAgo,
  int,
  NOW,
  pick,
  weighted,
} from "./seed"

/* -------------------------------------------------------------------------- */
/* Graph templates                                                             */
/* -------------------------------------------------------------------------- */

const ragGraph: GraphNode[] = [
  {
    id: "classify",
    label: "Classify intent",
    type: "router",
    next: ["retrieve", "escalate"],
  },
  {
    id: "retrieve",
    label: "Retrieve context",
    type: "retriever",
    next: ["answer"],
  },
  { id: "answer", label: "Draft answer", type: "llm", next: ["guard"] },
  { id: "guard", label: "Policy guard", type: "guard", next: ["respond"] },
  { id: "escalate", label: "Hand off to human", type: "human", next: [] },
  { id: "respond", label: "Respond", type: "chain", next: [] },
]

const toolGraph: GraphNode[] = [
  { id: "plan", label: "Plan", type: "llm", next: ["tools"] },
  { id: "tools", label: "Call tools", type: "tool", next: ["reflect"] },
  { id: "reflect", label: "Reflect", type: "llm", next: ["tools", "finish"] },
  { id: "finish", label: "Finish", type: "guard", next: [] },
]

const sqlGraph: GraphNode[] = [
  {
    id: "resolve",
    label: "Resolve entities",
    type: "retriever",
    next: ["sql"],
  },
  { id: "sql", label: "Generate SQL", type: "llm", next: ["validate"] },
  {
    id: "validate",
    label: "Validate against semantic layer",
    type: "guard",
    next: ["run", "sql"],
  },
  { id: "run", label: "Run query", type: "tool", next: ["narrate"] },
  { id: "narrate", label: "Narrate result", type: "llm", next: [] },
]

const trend = (
  rng: () => number,
  base: number,
  spread: number,
  n = 14,
  drift = 0
) =>
  Array.from(
    { length: n },
    (_, i) => Math.round((base + (rng() - 0.5) * spread + drift * i) * 10) / 10
  )

/* -------------------------------------------------------------------------- */
/* Agents                                                                      */
/* -------------------------------------------------------------------------- */

const r = createRng(7001)

export const deployedAgents: DeployedAgent[] = [
  {
    id: "agt-support-triage",
    name: "Support Triage",
    description:
      "Classifies inbound support conversations, pulls account context and drafts a first response for the service desk.",
    team: "Service Desk",
    ownerId: "u-003",
    framework: "LangGraph",
    version: "v3.4.1",
    environment: "production",
    modelId: "anthropic/claude-sonnet-5.5",
    fallbackModelId: "anthropic/claude-haiku-5.5",
    health: "Healthy",
    tools: ["search_knowledge", "read_account", "create_ticket"],
    graph: ragGraph,
    metrics: {
      requests24h: 4820,
      p50Ms: 1420,
      p95Ms: 3860,
      errorRate: 0.6,
      quality: 91,
      thumbsDownRate: 3.1,
      costPerDay: 212.4,
      tokens24h: 18_400_000,
      reviewRate: 2,
    },
    qualityTrend: trend(r, 91, 2),
    trafficTrend: trend(r, 4700, 900),
    driftScore: 0.08,
    lastDeployed: daysAgo(6),
    evalDataset: "support-golden-v12",
    semanticEntityIds: ["sem-open-incident", "sem-customer", "sem-sla-breach"],
    promptVersion: "p-41",
    params: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 2048,
      reasoningEffort: "low",
      stopSequences: ["</final>"],
      toolChoice: "auto",
      parallelToolCalls: true,
      responseFormat: "text",
      timeoutMs: 60000,
      maxToolCalls: 6,
      maxRetries: 2,
    },
  },
  {
    id: "agt-it-helpdesk",
    name: "IT Helpdesk Copilot",
    description:
      "Employee-facing assistant for password resets, access requests and how-to questions, with ticket creation.",
    team: "Service Desk",
    ownerId: "u-005",
    framework: "LangGraph",
    version: "v2.9.0",
    environment: "production",
    modelId: "openai/gpt-5.4-mini",
    health: "Drifting",
    tools: [
      "search_knowledge",
      "reset_password",
      "request_access",
      "create_ticket",
    ],
    graph: toolGraph,
    metrics: {
      requests24h: 7210,
      p50Ms: 980,
      p95Ms: 2940,
      errorRate: 1.9,
      quality: 83,
      thumbsDownRate: 7.8,
      costPerDay: 96.2,
      tokens24h: 22_100_000,
      reviewRate: 3,
    },
    qualityTrend: trend(r, 89, 1.5, 14, -0.45),
    trafficTrend: trend(r, 6400, 1200, 14, 60),
    driftScore: 0.31,
    lastDeployed: daysAgo(19),
    evalDataset: "helpdesk-golden-v8",
    semanticEntityIds: ["sem-employee", "sem-asset"],
    promptVersion: "p-27",
    params: {
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 1536,
      reasoningEffort: "low",
      stopSequences: [],
      toolChoice: "auto",
      parallelToolCalls: true,
      responseFormat: "text",
      timeoutMs: 60000,
      maxToolCalls: 8,
      maxRetries: 2,
    },
  },
  {
    id: "agt-ops-analyst",
    name: "Ops Analyst",
    description:
      "Answers natural-language questions about incidents, SLAs and service health by generating SQL through the semantic layer.",
    team: "Platform",
    ownerId: "u-001",
    framework: "LangChain",
    version: "v1.12.3",
    environment: "production",
    modelId: "anthropic/claude-fable-5.1",
    health: "Healthy",
    tools: ["semantic_lookup", "run_sql", "render_chart"],
    graph: sqlGraph,
    metrics: {
      requests24h: 640,
      p50Ms: 3100,
      p95Ms: 8900,
      errorRate: 2.4,
      quality: 94,
      thumbsDownRate: 2.2,
      costPerDay: 148.7,
      tokens24h: 6_900_000,
      reviewRate: 5,
    },
    qualityTrend: trend(r, 93.5, 1.5),
    trafficTrend: trend(r, 600, 180),
    driftScore: 0.05,
    lastDeployed: daysAgo(2),
    evalDataset: "ops-sql-v5",
    semanticEntityIds: [
      "sem-open-incident",
      "sem-mttr",
      "sem-sla-breach",
      "sem-service-availability",
      "sem-change-success",
    ],
    promptVersion: "p-18",
    params: {
      temperature: 0.0,
      topP: 1.0,
      maxOutputTokens: 4096,
      reasoningEffort: "medium",
      stopSequences: [";"],
      toolChoice: "required",
      parallelToolCalls: false,
      responseFormat: "json_schema",
      timeoutMs: 250000,
      maxToolCalls: 4,
      maxRetries: 2,
    },
  },
  {
    id: "agt-change-risk",
    name: "Change Risk Advisor",
    description:
      "Scores change requests from CMDB blast radius and history, drafts CAB notes and flags freeze-window conflicts.",
    team: "Change Management",
    ownerId: "u-007",
    framework: "LangGraph",
    version: "v4.0.0",
    environment: "production",
    modelId: "anthropic/claude-sonnet-5.5",
    health: "Degraded",
    tools: ["read_change", "search_services", "read_change_history"],
    graph: toolGraph,
    metrics: {
      requests24h: 215,
      p50Ms: 5200,
      p95Ms: 14_800,
      errorRate: 6.1,
      quality: 88,
      thumbsDownRate: 4.0,
      costPerDay: 61.3,
      tokens24h: 3_100_000,
      reviewRate: 10,
    },
    qualityTrend: trend(r, 88, 2),
    trafficTrend: trend(r, 210, 60),
    driftScore: 0.12,
    lastDeployed: hoursAgo(20),
    evalDataset: "change-risk-v3",
    semanticEntityIds: ["sem-change-success", "sem-freeze-window", "sem-asset"],
    promptVersion: "p-9",
    params: {
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 1024,
      reasoningEffort: "high",
      stopSequences: [],
      toolChoice: "auto",
      parallelToolCalls: false,
      responseFormat: "json_schema",
      timeoutMs: 120000,
      maxToolCalls: 5,
      maxRetries: 2,
    },
  },
  {
    id: "agt-hr-answers",
    name: "Policy Answers",
    description:
      "Employee policy Q&A over the handbook and knowledge base, with PII redaction and a mandatory hand-off to a person for sensitive topics.",
    team: "People Ops",
    ownerId: "u-009",
    framework: "LangChain",
    version: "v2.2.7",
    environment: "production",
    modelId: "google/gemini-3-flash-preview",
    health: "Healthy",
    tools: ["search_policies", "redact_pii", "handoff_to_human"],
    graph: ragGraph,
    metrics: {
      requests24h: 1930,
      p50Ms: 760,
      p95Ms: 2100,
      errorRate: 0.3,
      quality: 90,
      thumbsDownRate: 2.9,
      costPerDay: 18.9,
      tokens24h: 7_800_000,
      reviewRate: 4,
    },
    qualityTrend: trend(r, 90, 1.5),
    trafficTrend: trend(r, 1900, 400),
    driftScore: 0.09,
    lastDeployed: daysAgo(11),
    evalDataset: "hr-policy-v6",
    semanticEntityIds: ["sem-employee", "sem-leave-balance"],
    promptVersion: "p-33",
    params: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 1024,
      reasoningEffort: "low",
      stopSequences: [],
      toolChoice: "auto",
      parallelToolCalls: true,
      responseFormat: "text",
      timeoutMs: 50000,
      maxToolCalls: 4,
      maxRetries: 2,
    },
  },
  {
    id: "agt-alert-correlator",
    name: "Alert Correlator",
    description:
      "Groups monitoring alerts into probable incidents and proposes a root CI. Runs on a schedule, no end users.",
    team: "Site Reliability",
    ownerId: "u-011",
    framework: "Custom",
    version: "v0.9.4",
    environment: "production",
    modelId: "deepseek/deepseek-v3.2",
    health: "Healthy",
    tools: ["read_alerts", "search_services", "create_incident"],
    graph: toolGraph,
    metrics: {
      requests24h: 1440,
      p50Ms: 1900,
      p95Ms: 4400,
      errorRate: 0.9,
      quality: 87,
      thumbsDownRate: 0,
      costPerDay: 9.6,
      tokens24h: 9_200_000,
      reviewRate: 1,
    },
    qualityTrend: trend(r, 87, 2),
    trafficTrend: Array(14).fill(1440),
    driftScore: 0.04,
    lastDeployed: daysAgo(30),
    evalDataset: "alert-corr-v2",
    semanticEntityIds: ["sem-service-availability", "sem-asset"],
    promptVersion: "p-6",
    params: {
      temperature: 0.0,
      topP: 1.0,
      maxOutputTokens: 2048,
      reasoningEffort: "medium",
      stopSequences: [],
      toolChoice: "required",
      parallelToolCalls: true,
      responseFormat: "json_schema",
      timeoutMs: 150000,
      maxToolCalls: 10,
      maxRetries: 2,
    },
  },
  {
    id: "agt-kb-curator",
    name: "Knowledge Curator",
    description:
      "Drafts and refreshes knowledge articles from resolved incidents; everything it writes goes through review.",
    team: "Knowledge",
    ownerId: "u-002",
    framework: "LangGraph",
    version: "v1.5.0",
    environment: "production",
    modelId: "anthropic/claude-sonnet-5.5",
    health: "Healthy",
    tools: ["read_incident", "search_knowledge", "create_article"],
    graph: ragGraph,
    metrics: {
      requests24h: 86,
      p50Ms: 8400,
      p95Ms: 21_000,
      errorRate: 1.2,
      quality: 86,
      thumbsDownRate: 5.5,
      costPerDay: 24.1,
      tokens24h: 2_600_000,
      reviewRate: 100,
    },
    qualityTrend: trend(r, 86, 2.5),
    trafficTrend: trend(r, 80, 30),
    driftScore: 0.07,
    lastDeployed: daysAgo(8),
    evalDataset: "kb-draft-v4",
    semanticEntityIds: ["sem-open-incident"],
    promptVersion: "p-15",
    params: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 3000,
      reasoningEffort: "low",
      stopSequences: [],
      toolChoice: "auto",
      parallelToolCalls: true,
      responseFormat: "text",
      timeoutMs: 80000,
      maxToolCalls: 6,
      maxRetries: 2,
    },
  },
  {
    id: "agt-finance-copilot",
    name: "Finance Copilot",
    description:
      "Staging rollout of a spend-analysis assistant over the finance semantic layer. Not yet serving employees.",
    team: "Finance Systems",
    ownerId: "u-012",
    framework: "LangChain",
    version: "v0.3.1",
    environment: "staging",
    modelId: "openai/gpt-5.5",
    health: "Paused",
    tools: ["semantic_lookup", "run_sql"],
    graph: sqlGraph,
    metrics: {
      requests24h: 0,
      p50Ms: 0,
      p95Ms: 0,
      errorRate: 0,
      quality: 79,
      thumbsDownRate: 0,
      costPerDay: 0,
      tokens24h: 0,
      reviewRate: 100,
    },
    qualityTrend: trend(r, 78, 3),
    trafficTrend: Array(14).fill(0),
    driftScore: 0,
    lastDeployed: daysAgo(4),
    evalDataset: "finance-sql-v1",
    semanticEntityIds: ["sem-spend", "sem-cost-center", "sem-vendor"],
    promptVersion: "p-3",
    params: {
      temperature: 0.0,
      topP: 1.0,
      maxOutputTokens: 4096,
      reasoningEffort: "medium",
      stopSequences: [";"],
      toolChoice: "required",
      parallelToolCalls: false,
      responseFormat: "json_schema",
      timeoutMs: 300000,
      maxToolCalls: 4,
      maxRetries: 2,
    },
  },
]

export function getDeployedAgent(id: string) {
  return deployedAgents.find((a) => a.id === id)
}

/* -------------------------------------------------------------------------- */
/* Traces                                                                      */
/* -------------------------------------------------------------------------- */

const queriesByAgent: Record<string, [string, string][]> = {
  "agt-support-triage": [
    [
      "Customer says checkout keeps failing with a 5xx since this morning, order #A-99812.",
      "Thanks for the details. This matches an active major incident on the Payments API (INC0010078) that our Site Reliability team is working on right now. I have linked your report to it so you will be notified the moment it is resolved; no need to retry the order.",
    ],
    [
      "Our SSO login loops back to the sign-in page for everyone in the Berlin office.",
      "I have opened INC0010096 as a P2 for the Berlin office and routed it to Network Operations, since the pattern matches a VPN certificate issue they are already tracking. Expected update within 30 minutes.",
    ],
    [
      "How do I export my invoices for last quarter?",
      "You can export invoices from Billing → Statements → Export, choosing the date range Jul 1 to Sep 30. The file is generated as CSV within a minute. If you need PDFs, select 'Include documents' before exporting.",
    ],
  ],
  "agt-it-helpdesk": [
    [
      "I forgot my laptop password and I'm locked out.",
      "I have sent a one-time reset link to your registered mobile number. It is valid for 15 minutes. After resetting, sign in once while connected to the office network or VPN so the new password syncs to your laptop.",
    ],
    [
      "Can you give me access to the Finance shared drive?",
      "Access to the Finance shared drive requires approval from the drive owner, Priya Natarajan. I have created REQ0020087 and sent the approval request. Typical turnaround is one business day.",
    ],
    [
      "My Teams keeps crashing on startup since the update.",
      "Try these steps: 1) quit Teams fully, 2) delete the cache folder at %appdata%\\Microsoft\\Teams, 3) restart Teams. This resolves the issue in most cases after the 2.3 update. If it persists, reply here and I will open a ticket with the Desktop team.",
    ],
    [
      "Why is the wifi so slow on floor 3?",
      "There is a known problem record (PRB0040002) for intermittent Wi-Fi on floors 3–5. Network Operations is replacing a controller this week. For now, the 'Corp-5G' network is unaffected if your device supports it.",
    ],
  ],
  "agt-ops-analyst": [
    [
      "What was our MTTR for P1 incidents last month compared to the month before?",
      "P1 mean time to resolve was **4.6 h** in October versus **6.1 h** in September, a 25% improvement. Nine P1s were resolved in October; the longest (INC0010034, 11.2 h) was the Payments API outage on Oct 14.",
    ],
    [
      "Which services breached their availability SLO this quarter?",
      "Three services are below the 99.9% target quarter-to-date: Payments API (99.41%), Employee Portal (99.87%) and VPN Remote Access (99.87%). Payments API accounts for 71% of the total downtime minutes.",
    ],
  ],
  "agt-change-risk": [
    [
      "Assess CHG0031104",
      "CHG0031104 (node group scale on eks-prod-east) is **High risk**: the cluster hosts three tier-1 services with one open P1, and similar changes failed 1 of 4 times. Recommend CAB review and a backout validation step.",
    ],
    [
      "Any conflicts for changes scheduled Friday?",
      "Two conflicts: CHG0031110 and CHG0031112 both touch sw-core-east-01 within the same window, and CHG0031115 falls inside the month-end freeze. Suggest moving CHG0031112 to Saturday 02:00.",
    ],
  ],
  "agt-hr-answers": [
    [
      "How many days of parental leave do I get?",
      "Under the Parental Leave policy (KB0010221), primary carers get 18 weeks fully paid and secondary carers 6 weeks. Leave can be taken in up to two blocks within the first year. For your specific balance, I can hand you over to the People team to confirm.",
    ],
    [
      "Can my manager see my therapy appointments in the calendar?",
      "No. Appointments marked Private show only as 'Busy' to your manager and colleagues. If you are concerned about a specific entry, I can hand this over to the People team confidentially.",
    ],
  ],
  "agt-alert-correlator": [
    [
      "[scheduled] Correlate alerts window 14:20–14:25",
      "Grouped 3 alerts on sw-core-east-01 (PSU failure, CRC errors, link flaps) into one proposed incident with probable root CI sw-core-east-01. Suppressed 212 duplicate CloudWatch events.",
    ],
  ],
  "agt-kb-curator": [
    [
      "Draft an article from INC0010069",
      "Drafted 'Windows update loop on reboot — fix' from four matching resolutions. Symptoms, cause (pending KB5062xxx), and the two-step fix are included; sent to the Knowledge queue for review.",
    ],
  ],
  "agt-finance-copilot": [
    [
      "Which cost centers are over budget this quarter?",
      "Three cost centers are over budget: Cloud Infrastructure (+18%), Field Sales (+7%) and Recruiting (+4%). Cloud Infrastructure is driven by a 34% increase in EKS spend since September.",
    ],
  ],
}

function buildSpans(
  rng: () => number,
  agent: DeployedAgent,
  totalMs: number,
  failed: boolean,
  query: string,
  answer: string
): TraceSpan[] {
  const nodes = agent.graph.filter((n) => n.id !== "escalate")
  const spans: TraceSpan[] = []
  let cursor = 0
  const root: TraceSpan = {
    id: "s0",
    name: `${agent.name} · ${agent.framework} run`,
    type: "chain",
    startMs: 0,
    durationMs: totalMs,
    status: failed ? "error" : "ok",
    input: query,
    output: failed ? undefined : answer,
  }
  spans.push(root)
  const weights = nodes.map((n) =>
    n.type === "llm"
      ? 5
      : n.type === "retriever"
        ? 2
        : n.type === "tool"
          ? 2.5
          : 0.6
  )
  const totalW = weights.reduce((a, b) => a + b, 0)
  nodes.forEach((n, i) => {
    const share = weights[i] / totalW
    const dur = Math.max(40, Math.round(totalMs * share * (0.85 + rng() * 0.3)))
    const isLast = i === nodes.length - 1
    const errored = failed && isLast
    const span: TraceSpan = {
      id: `s${i + 1}`,
      parentId: "s0",
      name: n.label,
      type: n.type,
      startMs: cursor,
      durationMs: Math.min(dur, totalMs - cursor),
      status: errored ? "error" : "ok",
    }
    if (n.type === "llm") {
      span.modelId = agent.modelId
      span.tokensIn = int(rng, 900, 6200)
      span.tokensOut = int(rng, 80, 900)
      span.cost =
        Math.round(
          ((span.tokensIn * 3 + span.tokensOut * 15) / 1_000_000) * 1000
        ) / 1000
      span.input =
        i === 0
          ? query
          : "System prompt + retrieved context + conversation so far"
      span.output = errored
        ? "Error: upstream model timeout after 12 000 ms"
        : isLast
          ? answer
          : "{ intent: 'incident', confidence: 0.92, route: 'retrieve' }"
      span.attributes = {
        temperature: 0.2,
        prompt_version: agent.promptVersion,
      }
    } else if (n.type === "retriever") {
      span.attributes = {
        index: `${agent.evalDataset.split("-")[0]}-kb`,
        top_k: 6,
        hits: int(rng, 3, 6),
        min_score: 0.71,
      }
      span.output = "6 chunks · KB0010221, KB0010122, INC0010078 …"
    } else if (n.type === "tool") {
      span.attributes = {
        tool: pick(rng, agent.tools),
        status_code: errored ? 504 : 200,
      }
      span.output = errored ? "Gateway timeout" : "{ ok: true }"
    } else if (n.type === "guard") {
      span.attributes = {
        pii_redacted: chance(rng, 0.2),
        policy: "default-v3",
        verdict: errored ? "blocked" : "pass",
      }
    } else if (n.type === "router") {
      span.output = "intent=incident · confidence=0.92"
    }
    spans.push(span)
    cursor += span.durationMs
  })
  return spans
}

const flagPool = [
  "Low confidence",
  "Hallucination risk",
  "Missing citation",
  "Policy: PII",
  "Tool error",
  "Long latency",
]

function buildTraces(count: number): AgentTrace[] {
  const rng = createRng(7002)
  const out: AgentTrace[] = []
  const live = deployedAgents.filter((a) => a.metrics.requests24h > 0)
  for (let i = 0; i < count; i++) {
    const agent = weighted(
      rng,
      live.map(
        (a) => [a, Math.sqrt(a.metrics.requests24h)] as [DeployedAgent, number]
      )
    )
    const [q, a] = pick(rng, queriesByAgent[agent.id])
    const failed = chance(rng, agent.metrics.errorRate / 100 + 0.02)
    const durationMs = Math.round(
      agent.metrics.p50Ms * (0.6 + rng() * 1.4) +
        (chance(rng, 0.1) ? agent.metrics.p95Ms : 0)
    )
    const grounded = failed ? 0 : Math.min(1, 0.55 + rng() * 0.45)
    const helpful = failed ? 0 : Math.min(1, 0.5 + rng() * 0.5)
    const safe = chance(rng, 0.97) ? 1 : 0.6
    const flags: string[] = []
    if (!failed && grounded < 0.7) flags.push("Low confidence")
    if (!failed && grounded < 0.62) flags.push("Missing citation")
    if (safe < 1) flags.push("Policy: PII")
    if (failed) flags.push("Tool error")
    if (durationMs > agent.metrics.p95Ms) flags.push("Long latency")
    const feedback =
      agent.metrics.thumbsDownRate === 0
        ? undefined
        : chance(rng, 0.35)
          ? chance(rng, agent.metrics.thumbsDownRate / 20)
            ? "down"
            : "up"
          : undefined
    const needsReview =
      !failed &&
      (flags.length > 0 ||
        feedback === "down" ||
        chance(rng, agent.metrics.reviewRate / 100))
    const status: AgentTrace["status"] = failed
      ? "Failed"
      : needsReview
        ? chance(rng, 0.45)
          ? "Reviewed"
          : "Needs review"
        : "Succeeded"
    const spans = buildSpans(rng, agent, durationMs, failed, q, a)
    const llm = spans.filter((s) => s.type === "llm")
    const tokensIn = llm.reduce((s, x) => s + (x.tokensIn ?? 0), 0)
    const tokensOut = llm.reduce((s, x) => s + (x.tokensOut ?? 0), 0)
    const exp =
      agent.id === "agt-it-helpdesk"
        ? "exp-helpdesk-haiku"
        : agent.id === "agt-support-triage"
          ? "exp-triage-prompt-42"
          : undefined
    out.push({
      id: `tr_${(0x3f0000 + i * 7919).toString(16)}`,
      agentId: agent.id,
      startedAt: hoursAgo(rng() * 48),
      durationMs,
      status,
      channel:
        agent.id === "agt-alert-correlator" || agent.id === "agt-kb-curator"
          ? "API"
          : pick(rng, ["Web", "Web", "Slack", "Teams", "Email"]),
      sessionId: `ses_${int(rng, 10000, 99999)}`,
      userQuery: q,
      finalAnswer: failed
        ? "The assistant could not complete this request. A ticket has been opened for the service desk."
        : a,
      tokensIn,
      tokensOut,
      cost:
        Math.round(llm.reduce((s, x) => s + (x.cost ?? 0), 0) * 1000) / 1000,
      modelId: agent.modelId,
      version: agent.version,
      userFeedback: feedback,
      evals: {
        grounded: Math.round(grounded * 100) / 100,
        helpful: Math.round(helpful * 100) / 100,
        safe,
      },
      flags: flags.length ? flags : flagPool.filter(() => false),
      spans,
      experimentId: exp,
      variant: exp ? (chance(rng, 0.5) ? "A" : "B") : undefined,
    })
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export const agentTraces: AgentTrace[] = buildTraces(140)

export function getTrace(id: string) {
  return agentTraces.find((t) => t.id === id)
}

/* -------------------------------------------------------------------------- */
/* Review queue                                                                */
/* -------------------------------------------------------------------------- */

function buildReviews(): ReviewItem[] {
  const rng = createRng(7003)
  const candidates = agentTraces.filter(
    (t) => t.status === "Needs review" || t.status === "Reviewed"
  )
  return candidates.slice(0, 26).map((t, i) => {
    const reason: ReviewItem["reason"] =
      t.userFeedback === "down"
        ? "User thumbs-down"
        : t.flags.includes("Policy: PII")
          ? "Policy match"
          : t.flags.includes("Low confidence")
            ? "Low confidence"
            : t.flags.length
              ? "Evaluator flag"
              : "Random sample"
    const reviewed = t.status === "Reviewed"
    const status: ReviewItem["status"] = !reviewed
      ? "Pending"
      : weighted(rng, [
          ["Approved", 5],
          ["Flagged", 2],
          ["Corrected", 3],
        ])
    const priority: Priority =
      reason === "Policy match"
        ? 1
        : reason === "User thumbs-down"
          ? 2
          : reason === "Low confidence"
            ? 3
            : 4
    return {
      id: `rev-${String(i + 1).padStart(3, "0")}`,
      traceId: t.id,
      agentId: t.agentId,
      reason,
      priority,
      status,
      created: t.startedAt,
      assignedToId: chance(rng, 0.6)
        ? pick(rng, ["u-001", "u-002", "u-003", "u-005"])
        : undefined,
      reviewerId: reviewed ? pick(rng, ["u-001", "u-002", "u-003"]) : undefined,
      rubric: reviewed
        ? {
            accuracy: int(rng, 2, 5),
            grounding: int(rng, 2, 5),
            tone: int(rng, 3, 5),
            safety: int(rng, 4, 5),
          }
        : undefined,
      correction:
        status === "Corrected"
          ? "Clarified that the reset link expires after 15 minutes and added the VPN sync step the original answer omitted."
          : undefined,
      note:
        status === "Flagged"
          ? "Cited an article that was retired last month; retrieval index needs a refresh."
          : undefined,
    }
  })
}

export const reviewItems: ReviewItem[] = buildReviews()

/* -------------------------------------------------------------------------- */
/* Drift                                                                       */
/* -------------------------------------------------------------------------- */

const d = createRng(7004)
export const driftSignals: DriftSignal[] = [
  {
    id: "drf-001",
    agentId: "agt-it-helpdesk",
    kind: "input",
    metric: "Topic mix shift (PSI)",
    baseline: 0.04,
    current: 0.31,
    unit: "",
    severity: "Critical",
    state: "Open",
    detected: hoursAgo(6),
    explanation:
      "Share of conversations about Teams crashes rose from 3% to 21% after the 2.3 desktop update. The retrieval index has no article covering the new failure mode, so answers fall back to generic troubleshooting.",
    history: trend(d, 0.05, 0.02, 14, 0.02),
  },
  {
    id: "drf-002",
    agentId: "agt-it-helpdesk",
    kind: "quality",
    metric: "Grounded score",
    baseline: 0.88,
    current: 0.74,
    unit: "",
    severity: "Warning",
    state: "Open",
    detected: hoursAgo(9),
    explanation:
      "Evaluator grounding fell in step with the topic shift: 38% of Teams-related answers cite no retrieved source.",
    history: trend(d, 0.88, 0.02, 14, -0.011),
  },
  {
    id: "drf-003",
    agentId: "agt-it-helpdesk",
    kind: "output",
    metric: "Thumbs-down rate",
    baseline: 3.2,
    current: 7.8,
    unit: "%",
    severity: "Warning",
    state: "Acknowledged",
    detected: hoursAgo(14),
    explanation:
      "Negative feedback concentrated on the same Teams topic cluster. Correlates with grounding drop.",
    history: trend(d, 3.4, 0.6, 14, 0.33),
  },
  {
    id: "drf-004",
    agentId: "agt-change-risk",
    kind: "tool",
    metric: "Tool error rate",
    baseline: 0.8,
    current: 6.1,
    unit: "%",
    severity: "Critical",
    state: "Open",
    detected: hoursAgo(20),
    explanation:
      "search_services calls time out since the service inventory API moved behind the new gateway at 18:00 yesterday. Deploy v4.0.0 coincided, so the agent is also retrying more aggressively.",
    history: trend(d, 0.9, 0.3, 14, 0.38),
  },
  {
    id: "drf-005",
    agentId: "agt-change-risk",
    kind: "cost",
    metric: "Cost per request",
    baseline: 0.19,
    current: 0.29,
    unit: "$",
    severity: "Warning",
    state: "Open",
    detected: hoursAgo(19),
    explanation:
      "Reflect → tools loop runs 2.4× on average instead of 1.3× because of the tool timeouts above.",
    history: trend(d, 0.19, 0.02, 14, 0.007),
  },
  {
    id: "drf-006",
    agentId: "agt-support-triage",
    kind: "output",
    metric: "Answer length",
    baseline: 92,
    current: 131,
    unit: "words",
    severity: "Info",
    state: "Acknowledged",
    detected: daysAgo(2),
    explanation:
      "Prompt p-41 added an explicit 'next steps' section; length increase is expected. Monitor thumbs-down.",
    history: trend(d, 92, 6, 14, 2.8),
  },
  {
    id: "drf-007",
    agentId: "agt-hr-answers",
    kind: "input",
    metric: "Embedding centroid shift",
    baseline: 0.02,
    current: 0.09,
    unit: "",
    severity: "Info",
    state: "Resolved",
    detected: daysAgo(5),
    explanation:
      "Open-enrollment questions spiked for the benefits window. Seasonal; resolved as expected behaviour.",
    history: trend(d, 0.03, 0.01, 14, 0.004),
  },
  {
    id: "drf-008",
    agentId: "agt-ops-analyst",
    kind: "quality",
    metric: "SQL validation failures",
    baseline: 1.1,
    current: 2.4,
    unit: "%",
    severity: "Warning",
    state: "Open",
    detected: hoursAgo(30),
    explanation:
      "New questions reference 'change success rate', which is still a Draft entity in the semantic layer. Verifying the metric should fix generation.",
    history: trend(d, 1.1, 0.3, 14, 0.09),
  },
  {
    id: "drf-009",
    agentId: "agt-kb-curator",
    kind: "output",
    metric: "Refusal rate",
    baseline: 0.5,
    current: 0.4,
    unit: "%",
    severity: "Info",
    state: "Resolved",
    detected: daysAgo(7),
    explanation: "Within normal variance.",
    history: trend(d, 0.5, 0.1),
  },
]

/* -------------------------------------------------------------------------- */
/* Experiments                                                                 */
/* -------------------------------------------------------------------------- */

const days = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(NOW.getTime() - (n - 1 - i) * 86_400_000).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", timeZone: "UTC" }
    )
  )
const e = createRng(7005)
const daily = (n: number, a: number, b: number, spread: number) =>
  days(n).map((name) => ({
    name,
    A: Math.round((a + (e() - 0.5) * spread) * 10) / 10,
    B: Math.round((b + (e() - 0.5) * spread) * 10) / 10,
  }))

export const experiments: Experiment[] = [
  {
    id: "exp-helpdesk-haiku",
    name: "Helpdesk: GPT-5.4 mini → Claude Haiku 5.5",
    agentId: "agt-it-helpdesk",
    hypothesis:
      "Claude Haiku 5.5 matches quality on the helpdesk golden set at ~40% lower cost and better tool-call reliability.",
    kind: "model",
    status: "Running",
    split: 30,
    primaryMetric: "quality",
    started: daysAgo(9),
    ends: daysAgo(-5),
    ownerId: "u-005",
    variants: [
      {
        key: "A",
        label: "Control · GPT-5.4 mini",
        modelId: "openai/gpt-5.4-mini",
        requests: 31_240,
        quality: 83.1,
        p95Ms: 2940,
        costPer1k: 13.3,
        thumbsUp: 71,
        errorRate: 1.9,
      },
      {
        key: "B",
        label: "Variant · Claude Haiku 5.5",
        modelId: "anthropic/claude-haiku-5.5",
        requests: 13_410,
        quality: 85.9,
        p95Ms: 2210,
        costPer1k: 8.1,
        thumbsUp: 76,
        errorRate: 0.7,
      },
    ],
    significance: 0.97,
    daily: daily(9, 83, 86, 3),
  },
  {
    id: "exp-triage-prompt-42",
    name: "Triage: prompt p-42 with explicit citations",
    agentId: "agt-support-triage",
    hypothesis:
      "Requiring an inline citation for every factual claim raises grounded score without hurting helpfulness.",
    kind: "prompt",
    status: "Running",
    split: 50,
    primaryMetric: "quality",
    started: daysAgo(4),
    ends: daysAgo(-10),
    ownerId: "u-003",
    variants: [
      {
        key: "A",
        label: "Control · p-41",
        promptVersion: "p-41",
        requests: 9_620,
        quality: 91.0,
        p95Ms: 3860,
        costPer1k: 44.0,
        thumbsUp: 82,
        errorRate: 0.6,
      },
      {
        key: "B",
        label: "Variant · p-42",
        promptVersion: "p-42",
        requests: 9_580,
        quality: 91.6,
        p95Ms: 4120,
        costPer1k: 46.9,
        thumbsUp: 81,
        errorRate: 0.6,
      },
    ],
    significance: 0.61,
    daily: daily(4, 91, 91.5, 2),
  },
  {
    id: "exp-ops-retrieval",
    name: "Ops Analyst: hybrid retrieval for entity resolution",
    agentId: "agt-ops-analyst",
    hypothesis:
      "BM25 + embeddings resolves semantic-layer entities more reliably than embeddings alone, reducing SQL validation failures.",
    kind: "retrieval",
    status: "Completed",
    split: 50,
    primaryMetric: "quality",
    started: daysAgo(21),
    ends: daysAgo(7),
    ownerId: "u-001",
    variants: [
      {
        key: "A",
        label: "Control · embeddings",
        requests: 4_210,
        quality: 92.4,
        p95Ms: 8900,
        costPer1k: 232,
        thumbsUp: 84,
        errorRate: 2.9,
      },
      {
        key: "B",
        label: "Variant · hybrid",
        requests: 4_180,
        quality: 94.8,
        p95Ms: 9100,
        costPer1k: 236,
        thumbsUp: 88,
        errorRate: 1.6,
      },
    ],
    significance: 0.99,
    winner: "B",
    daily: daily(14, 92.4, 94.8, 2.5),
  },
  {
    id: "exp-hr-flash",
    name: "Policy Answers: Gemini 3 Flash → Gemini 3.1 Flash Lite",
    agentId: "agt-hr-answers",
    hypothesis: "The Lite model is sufficient for policy Q&A and halves cost.",
    kind: "model",
    status: "Stopped",
    split: 20,
    primaryMetric: "cost",
    started: daysAgo(16),
    ends: daysAgo(12),
    ownerId: "u-009",
    variants: [
      {
        key: "A",
        label: "Control · Gemini 3 Flash",
        modelId: "google/gemini-3-flash-preview",
        requests: 6_880,
        quality: 90.2,
        p95Ms: 2100,
        costPer1k: 9.8,
        thumbsUp: 80,
        errorRate: 0.3,
      },
      {
        key: "B",
        label: "Variant · Gemini 3.1 Flash Lite",
        modelId: "google/gemini-3.1-flash-lite",
        requests: 1_720,
        quality: 84.1,
        p95Ms: 1600,
        costPer1k: 4.9,
        thumbsUp: 69,
        errorRate: 0.4,
      },
    ],
    significance: 0.99,
    winner: "A",
    daily: daily(4, 90.2, 84.1, 2),
  },
  {
    id: "exp-change-tooling",
    name: "Change Risk: parallel tool calls",
    agentId: "agt-change-risk",
    hypothesis:
      "Issuing CMDB and history lookups in parallel cuts p95 latency by a third.",
    kind: "tooling",
    status: "Draft",
    split: 50,
    primaryMetric: "latency",
    started: daysAgo(-2),
    ownerId: "u-007",
    variants: [
      {
        key: "A",
        label: "Control · sequential",
        requests: 0,
        quality: 88,
        p95Ms: 14_800,
        costPer1k: 285,
        thumbsUp: 0,
        errorRate: 6.1,
      },
      {
        key: "B",
        label: "Variant · parallel",
        requests: 0,
        quality: 88,
        p95Ms: 0,
        costPer1k: 0,
        thumbsUp: 0,
        errorRate: 0,
      },
    ],
    significance: 0,
    daily: [],
  },
]

export function getExperiment(id: string) {
  return experiments.find((x) => x.id === id)
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                             */
/* -------------------------------------------------------------------------- */

export const modelRecommendations: ModelRecommendation[] = [
  {
    id: "rec-001",
    agentId: "agt-it-helpdesk",
    kind: "cost",
    title: "Move IT Helpdesk Copilot to Claude Haiku 5.5",
    summary:
      "The running experiment shows Haiku 5.5 ahead on quality (+2.8) and thumbs-up (+5 pts) at 39% lower cost per 1K requests. Significance has held above 95% for three days.",
    fromModelId: "openai/gpt-5.4-mini",
    toModelId: "anthropic/claude-haiku-5.5",
    evidence: [
      { metric: "Quality score", from: "83.1", to: "85.9", good: true },
      { metric: "Cost / 1K requests", from: "$13.30", to: "$8.10", good: true },
      { metric: "p95 latency", from: "2.9 s", to: "2.2 s", good: true },
      { metric: "Tool error rate", from: "1.9%", to: "0.7%", good: true },
    ],
    confidence: 0.94,
    savingsPerMonth: 1130,
    status: "Testing",
    created: daysAgo(3),
    experimentId: "exp-helpdesk-haiku",
  },
  {
    id: "rec-002",
    agentId: "agt-support-triage",
    kind: "cost",
    title: "Route simple intents on Support Triage to Haiku 5.5",
    summary:
      "61% of triage traffic is classified as 'how-to' with grounded score above 0.9. Shadow evals show Haiku 5.5 matches Sonnet 5.5 on that slice; keep Sonnet for incidents and escalations.",
    fromModelId: "anthropic/claude-sonnet-5.5",
    toModelId: "anthropic/claude-haiku-5.5",
    evidence: [
      {
        metric: "Quality (how-to slice)",
        from: "92.1",
        to: "91.7",
        good: true,
      },
      { metric: "Cost / day", from: "$212", to: "$131", good: true },
      { metric: "p50 latency", from: "1.4 s", to: "0.8 s", good: true },
    ],
    confidence: 0.82,
    savingsPerMonth: 2430,
    status: "New",
    created: daysAgo(1),
  },
  {
    id: "rec-003",
    agentId: "agt-change-risk",
    kind: "latency",
    title:
      "Change Risk Advisor: upgrade to Claude Fable 5.1 with parallel tools",
    summary:
      "p95 of 14.8 s is driven by the reflect loop. Fable 5.1 completes the plan in one pass on 88% of eval cases, cutting median tool calls from 4.1 to 2.3.",
    fromModelId: "anthropic/claude-sonnet-5.5",
    toModelId: "anthropic/claude-fable-5.1",
    evidence: [
      { metric: "p95 latency", from: "14.8 s", to: "9.6 s", good: true },
      { metric: "Quality score", from: "88", to: "92", good: true },
      { metric: "Cost / request", from: "$0.29", to: "$0.41", good: false },
    ],
    confidence: 0.76,
    status: "New",
    created: hoursAgo(18),
  },
  {
    id: "rec-004",
    agentId: "agt-alert-correlator",
    kind: "deprecation",
    title: "DeepSeek V3.2 reaches end of life on Dec 15",
    summary:
      "The provider has scheduled deprecation. DeepSeek V3.2-exp is the drop-in successor; evals show no regression on the alert-correlation set.",
    fromModelId: "deepseek/deepseek-v3.2",
    toModelId: "deepseek/deepseek-v3.2-exp",
    evidence: [
      { metric: "Quality score", from: "87", to: "87", good: true },
      { metric: "Cost / day", from: "$9.60", to: "$9.60", good: true },
    ],
    confidence: 0.9,
    status: "New",
    created: daysAgo(2),
  },
  {
    id: "rec-005",
    agentId: "agt-ops-analyst",
    kind: "context",
    title:
      "Ops Analyst: send the full semantic layer instead of top-k entities",
    summary:
      "With a 1M-token context, Fable 5.1 can take all 42 verified entity definitions in the prompt. In evals this removed 71% of entity-resolution errors and the retrieval step entirely.",
    fromModelId: "anthropic/claude-fable-5.1",
    toModelId: "anthropic/claude-fable-5.1",
    evidence: [
      {
        metric: "SQL validation failures",
        from: "2.4%",
        to: "0.7%",
        good: true,
      },
      { metric: "p95 latency", from: "8.9 s", to: "7.4 s", good: true },
      { metric: "Cost / request", from: "$0.23", to: "$0.31", good: false },
    ],
    confidence: 0.71,
    status: "New",
    created: hoursAgo(30),
  },
  {
    id: "rec-006",
    agentId: "agt-hr-answers",
    kind: "quality",
    title: "Keep Policy Answers on Gemini 3 Flash",
    summary:
      "The Flash Lite experiment was stopped after quality fell 6 points and thumbs-up dropped 11 points. No cheaper model clears the HR policy eval bar today.",
    fromModelId: "google/gemini-3-flash-preview",
    toModelId: "google/gemini-3-flash-preview",
    evidence: [
      { metric: "Quality (Flash Lite)", from: "90.2", to: "84.1", good: false },
      { metric: "Thumbs-up (Flash Lite)", from: "80%", to: "69%", good: false },
    ],
    confidence: 0.99,
    status: "Dismissed",
    created: daysAgo(12),
    experimentId: "exp-hr-flash",
  },
]

/* -------------------------------------------------------------------------- */
/* Semantic layer                                                              */
/* -------------------------------------------------------------------------- */

export const semanticEntities: SemanticEntity[] = [
  {
    id: "sem-open-incident",
    name: "Open incident",
    kind: "entity",
    domain: "ITSM",
    definition:
      "An incident whose state is New, In Progress or On Hold. Excludes incidents awaiting caller confirmation.",
    formula: "incident.state IN ('New','In Progress','On Hold')",
    sources: ["itsm.incident"],
    synonyms: ["active incident", "unresolved ticket", "open ticket"],
    ownerId: "u-003",
    status: "Verified",
    usedByAgentIds: ["agt-support-triage", "agt-ops-analyst", "agt-kb-curator"],
    queries30d: 4120,
    lastVerified: daysAgo(12),
    issues: [],
  },
  {
    id: "sem-mttr",
    name: "Mean time to resolve (MTTR)",
    kind: "metric",
    domain: "ITSM",
    definition:
      "Average elapsed time between an incident being opened and resolved, in hours, over resolved incidents in the period. Excludes Canceled.",
    formula:
      "AVG(TIMESTAMPDIFF(hour, opened, resolved)) WHERE state IN ('Resolved','Closed')",
    sources: ["itsm.incident"],
    synonyms: ["time to resolve", "resolution time", "MTTR"],
    ownerId: "u-001",
    status: "Verified",
    usedByAgentIds: ["agt-ops-analyst"],
    queries30d: 860,
    lastVerified: daysAgo(30),
    issues: [],
  },
  {
    id: "sem-sla-breach",
    name: "SLA breach",
    kind: "metric",
    domain: "ITSM",
    definition:
      "Count of incidents whose resolution SLA elapsed before the incident was resolved.",
    formula: "COUNT(*) WHERE sla_breached = true",
    sources: ["itsm.incident", "itsm.sla_task"],
    synonyms: ["breached SLA", "missed SLA", "SLA miss"],
    ownerId: "u-003",
    status: "Verified",
    usedByAgentIds: ["agt-support-triage", "agt-ops-analyst"],
    queries30d: 1310,
    lastVerified: daysAgo(12),
    issues: [],
  },
  {
    id: "sem-service-availability",
    name: "Service availability",
    kind: "metric",
    domain: "Operations",
    definition:
      "Share of minutes in the period during which a business service had no open Critical alert, as a percentage.",
    formula: "1 - SUM(critical_alert_minutes) / total_minutes",
    sources: ["itom.alert", "cmdb.business_service"],
    synonyms: ["uptime", "availability %", "SLO attainment"],
    ownerId: "u-011",
    status: "Verified",
    usedByAgentIds: ["agt-ops-analyst", "agt-alert-correlator"],
    queries30d: 540,
    lastVerified: daysAgo(20),
    issues: [],
  },
  {
    id: "sem-change-success",
    name: "Change success rate",
    kind: "metric",
    domain: "ITSM",
    definition:
      "Share of implemented changes closed as Successful without a backout, in the period.",
    formula: "COUNT(close_code='Successful') / COUNT(state='Closed')",
    sources: ["itsm.change_request"],
    synonyms: ["successful changes", "change failure rate (inverse)"],
    ownerId: "u-007",
    status: "Draft",
    usedByAgentIds: ["agt-ops-analyst", "agt-change-risk"],
    queries30d: 210,
    issues: [
      "Referenced by 2 agents while still Draft",
      "Ambiguous with 'change failure rate' (no inverse defined)",
    ],
  },
  {
    id: "sem-freeze-window",
    name: "Change freeze window",
    kind: "dimension",
    domain: "ITSM",
    definition:
      "A calendar range during which only Emergency changes may be implemented.",
    sources: ["itsm.freeze_window"],
    synonyms: ["blackout period", "freeze", "moratorium"],
    ownerId: "u-007",
    status: "Verified",
    usedByAgentIds: ["agt-change-risk"],
    queries30d: 95,
    lastVerified: daysAgo(40),
    issues: [],
  },
  {
    id: "sem-customer",
    name: "Customer",
    kind: "entity",
    domain: "Customer",
    definition:
      "An external organisation with at least one active subscription. Trial accounts are not customers.",
    formula: "account.type = 'customer' AND account.active_subscriptions > 0",
    sources: ["crm.account", "billing.subscription"],
    synonyms: ["account", "client", "tenant"],
    ownerId: "u-004",
    status: "Needs review",
    usedByAgentIds: ["agt-support-triage"],
    queries30d: 2210,
    lastVerified: daysAgo(95),
    issues: [
      "Last verified 95 days ago (policy: 90)",
      "'tenant' also maps to Workspace in the Product domain",
    ],
  },
  {
    id: "sem-employee",
    name: "Employee",
    kind: "entity",
    domain: "HR",
    definition:
      "A person with an active employment contract, including fixed-term staff. Contractors are a separate entity.",
    formula: "worker.type = 'employee' AND worker.status = 'active'",
    sources: ["hr.worker"],
    synonyms: ["staff member", "colleague", "team member"],
    ownerId: "u-009",
    status: "Verified",
    usedByAgentIds: ["agt-it-helpdesk", "agt-hr-answers"],
    queries30d: 3880,
    lastVerified: daysAgo(8),
    issues: [],
  },
  {
    id: "sem-leave-balance",
    name: "Leave balance",
    kind: "metric",
    domain: "HR",
    definition:
      "Days of paid leave accrued minus days taken or scheduled, for the current leave year.",
    formula: "accrued_days - taken_days - scheduled_days",
    sources: ["hr.leave_ledger"],
    synonyms: ["PTO balance", "vacation days left", "holiday allowance"],
    ownerId: "u-009",
    status: "Verified",
    usedByAgentIds: ["agt-hr-answers"],
    queries30d: 1540,
    lastVerified: daysAgo(8),
    issues: [],
  },
  {
    id: "sem-asset",
    name: "Managed asset",
    kind: "entity",
    domain: "Operations",
    definition:
      "A hardware or software CI with a lifecycle owner, tracked in the CMDB. Excludes retired CIs.",
    formula: "cmdb_ci.status != 'Retired'",
    sources: ["cmdb.ci", "asset.hardware", "asset.software"],
    synonyms: ["CI", "device", "configuration item"],
    ownerId: "u-011",
    status: "Verified",
    usedByAgentIds: [
      "agt-it-helpdesk",
      "agt-change-risk",
      "agt-alert-correlator",
    ],
    queries30d: 1790,
    lastVerified: daysAgo(15),
    issues: [],
  },
  {
    id: "sem-spend",
    name: "Spend",
    kind: "metric",
    domain: "Finance",
    definition:
      "Sum of posted invoice amounts in the reporting currency for the period, excluding intercompany.",
    formula: "SUM(invoice.amount_base) WHERE posted AND NOT intercompany",
    sources: ["erp.invoice", "erp.gl_posting"],
    synonyms: ["expenditure", "costs", "actuals"],
    ownerId: "u-012",
    status: "Draft",
    usedByAgentIds: ["agt-finance-copilot"],
    queries30d: 40,
    issues: ["No owner sign-off", "Currency conversion date not specified"],
  },
  {
    id: "sem-cost-center",
    name: "Cost center",
    kind: "dimension",
    domain: "Finance",
    definition:
      "Organisational unit to which spend is attributed, from the ERP hierarchy level 3.",
    sources: ["erp.cost_center"],
    synonyms: ["department code", "CC"],
    ownerId: "u-012",
    status: "Draft",
    usedByAgentIds: ["agt-finance-copilot"],
    queries30d: 38,
    issues: ["No owner sign-off"],
  },
  {
    id: "sem-vendor",
    name: "Vendor",
    kind: "entity",
    domain: "Finance",
    definition:
      "A supplier with at least one posted invoice in the last 24 months.",
    sources: ["erp.supplier"],
    synonyms: ["supplier", "provider"],
    ownerId: "u-012",
    status: "Deprecated",
    usedByAgentIds: ["agt-finance-copilot"],
    queries30d: 12,
    lastVerified: daysAgo(200),
    issues: ["Superseded by 'Supplier' in the Procurement domain"],
  },
  {
    id: "sem-p1",
    name: "Priority 1",
    kind: "glossary",
    domain: "ITSM",
    definition:
      "Critical priority: widespread outage or severe business impact. Response 15 min, resolution 4 h.",
    sources: [],
    synonyms: ["P1", "critical", "sev-1", "major"],
    ownerId: "u-003",
    status: "Verified",
    usedByAgentIds: [
      "agt-support-triage",
      "agt-ops-analyst",
      "agt-alert-correlator",
    ],
    queries30d: 2960,
    lastVerified: daysAgo(12),
    issues: [],
  },
  {
    id: "sem-fcr",
    name: "First contact resolution",
    kind: "metric",
    domain: "ITSM",
    definition:
      "Share of incidents resolved by the first assignee without reassignment.",
    formula: "COUNT(reassignment_count = 0 AND resolved) / COUNT(resolved)",
    sources: ["itsm.incident"],
    synonyms: ["FCR", "first-touch resolution"],
    ownerId: "u-003",
    status: "Needs review",
    usedByAgentIds: ["agt-ops-analyst"],
    queries30d: 320,
    lastVerified: daysAgo(100),
    issues: ["Last verified 100 days ago (policy: 90)"],
  },
]

export function getSemanticEntity(id: string) {
  return semanticEntities.find((s) => s.id === id)
}

/* -------------------------------------------------------------------------- */
/* Fleet-level series                                                          */
/* -------------------------------------------------------------------------- */

const f = createRng(7006)
/** Last 30 days of fleet traffic, quality and cost. */
export const fleetDaily = days(30).map((name, i) => {
  const weekend = i % 7 === 5 || i % 7 === 6
  const base = weekend ? 7800 : 15_600
  const requests = Math.round(base + (f() - 0.5) * 2400 + i * 60)
  return {
    name,
    requests,
    errors: Math.round(
      requests * (0.011 + (f() - 0.5) * 0.004 + (i > 26 ? 0.006 : 0))
    ),
    reviewed: Math.round(requests * 0.028),
    quality:
      Math.round(
        (89.5 + (f() - 0.5) * 1.6 - (i > 24 ? (i - 24) * 0.35 : 0)) * 10
      ) / 10,
    cost: Math.round((requests * 0.0345 + (f() - 0.5) * 40) * 100) / 100,
  }
})
