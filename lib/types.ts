/**
 * AgentOps domain model. The Agent Operations section (bottom of the file)
 * is the product; the ITSM / ITOM records above it are the service-management
 * layer the agents plug into.
 */

export type Impact = 1 | 2 | 3
export type Urgency = 1 | 2 | 3
export type Priority = 1 | 2 | 3 | 4 | 5

export interface User {
  id: string
  name: string
  email: string
  title: string
  department: string
  location: string
  avatar?: string
  vip?: boolean
}

export interface Group {
  id: string
  name: string
  type: "itil" | "fulfillment" | "approval" | "hr" | "cab"
  manager: string
  members: number
  description: string
}

export type IncidentState =
  "New" | "In Progress" | "On Hold" | "Resolved" | "Closed" | "Canceled"

export interface Incident {
  number: string
  shortDescription: string
  description: string
  callerId: string
  category: string
  subcategory: string
  impact: Impact
  urgency: Urgency
  priority: Priority
  state: IncidentState
  assignmentGroupId: string
  assignedToId?: string
  ciId?: string
  channel:
    "Self-service" | "Phone" | "Email" | "Chat" | "Walk-in" | "Monitoring"
  opened: string
  updated: string
  resolved?: string
  slaDue: string
  slaBreached: boolean
  majorIncident: boolean
  problemId?: string
  changeId?: string
  reopenCount: number
}

export type ProblemState =
  | "New"
  | "Assess"
  | "Root Cause Analysis"
  | "Fix in Progress"
  | "Resolved"
  | "Closed"

export interface Problem {
  number: string
  shortDescription: string
  state: ProblemState
  priority: Priority
  assignmentGroupId: string
  assignedToId?: string
  ciId?: string
  relatedIncidents: number
  knownError: boolean
  workaround?: string
  rootCause?: string
  opened: string
  updated: string
}

export type ChangeType = "Standard" | "Normal" | "Emergency"
export type ChangeState =
  | "New"
  | "Assess"
  | "Authorize"
  | "Scheduled"
  | "Implement"
  | "Review"
  | "Closed"
  | "Canceled"
export type ChangeRisk = "Low" | "Moderate" | "High" | "Very High"
export type ApprovalState =
  "Not Yet Requested" | "Requested" | "Approved" | "Rejected"

export interface Change {
  number: string
  shortDescription: string
  description: string
  type: ChangeType
  state: ChangeState
  risk: ChangeRisk
  impact: Impact
  priority: Priority
  category: string
  assignmentGroupId: string
  assignedToId?: string
  requestedById: string
  ciId?: string
  approval: ApprovalState
  cabRequired: boolean
  plannedStart: string
  plannedEnd: string
  opened: string
  updated: string
  implementationPlan: string
  backoutPlan: string
  testPlan: string
}

export type RequestState =
  | "Pending Approval"
  | "Approved"
  | "In Progress"
  | "Closed Complete"
  | "Closed Incomplete"
  | "Closed Cancelled"

export type RequestStage =
  | "Waiting for Approval"
  | "Fulfillment"
  | "Delivery"
  | "Completed"
  | "Cancelled"

export interface CatalogTask {
  number: string
  shortDescription: string
  state: "Open" | "Work in Progress" | "Closed Complete" | "Closed Incomplete"
  assignmentGroupId: string
  assignedToId?: string
  due: string
}

export interface RequestedItem {
  number: string
  catalogItemId: string
  quantity: number
  state: RequestState
  stage: RequestStage
  assignmentGroupId: string
  tasks: CatalogTask[]
  variables: Record<string, string>
}

export interface Request {
  number: string
  requestedForId: string
  requestedById: string
  state: RequestState
  stage: RequestStage
  approval: ApprovalState
  items: RequestedItem[]
  price: number
  opened: string
  updated: string
  dueDate: string
}

export type CatalogCategory =
  | "Hardware"
  | "Software"
  | "Access & Accounts"
  | "Cloud & Infrastructure"
  | "Collaboration"
  | "HR Services"
  | "Facilities"

export interface CatalogItem {
  id: string
  name: string
  category: CatalogCategory
  description: string
  price: number
  deliveryDays: number
  icon: string
  popular: boolean
  approvalRequired: boolean
  fulfillmentGroupId: string
}

export type KnowledgeState = "Draft" | "Review" | "Published" | "Retired"

export interface KnowledgeArticle {
  number: string
  title: string
  summary: string
  knowledgeBase: "IT" | "HR" | "Facilities" | "Security"
  category: string
  state: KnowledgeState
  authorId: string
  views: number
  helpful: number
  notHelpful: number
  updated: string
  published?: string
  tags: string[]
}

export type CiClass =
  | "Linux Server"
  | "Windows Server"
  | "Virtual Machine"
  | "Database"
  | "Application"
  | "Business Service"
  | "Network Gear"
  | "Load Balancer"
  | "Storage"
  | "Cloud Resource"
  | "Kubernetes Cluster"

export type CiStatus =
  | "Operational"
  | "Non-Operational"
  | "Repair in Progress"
  | "Retired"
  | "Pipeline"

export type Environment =
  "Production" | "Staging" | "Development" | "Test" | "DR"

export type RelationshipType =
  | "Depends on::Used by"
  | "Runs on::Runs"
  | "Hosted on::Hosts"
  | "Connected by::Connects"
  | "Members::Member of"

export interface CiRelationship {
  type: RelationshipType
  parentId: string
  childId: string
}

/**
 * A system or business service the agents plug into (servers, databases,
 * clusters, business services). Internal data source only; there is no
 * user-facing inventory page; records reference these by `ciId`.
 */
export interface ConfigurationItem {
  id: string
  name: string
  class: CiClass
  status: CiStatus
  environment: Environment
  location: string
  ownerId: string
  supportGroupId: string
  ipAddress?: string
  os?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  businessCriticality:
    | "1 - Most Critical"
    | "2 - Somewhat Critical"
    | "3 - Less Critical"
    | "4 - Not Critical"
  discoverySource:
    "Discovery" | "ServiceGraph Connector" | "Manual" | "Cloud API"
  lastDiscovered: string
  installed: string
  tags: string[]
}

export type AlertSeverity =
  "Critical" | "Major" | "Minor" | "Warning" | "Info" | "Clear"
export type AlertState = "Open" | "Reopen" | "Flapping" | "Closed"

export interface Alert {
  number: string
  severity: AlertSeverity
  state: AlertState
  source: string
  node: string
  metric: string
  description: string
  ciId?: string
  incidentNumber?: string
  acknowledged: boolean
  acknowledgedById?: string
  count: number
  opened: string
  updated: string
}

export interface ServiceHealth {
  ciId: string
  name: string
  health: "Healthy" | "Degraded" | "Critical" | "Unknown"
  availability30d: number
  openAlerts: number
  openIncidents: number
  activeChanges: number
  owner: string
}

export interface ActivityEntry {
  id: string
  recordNumber: string
  type:
    "comment" | "work_note" | "field_change" | "email" | "system" | "approval"
  authorId: string
  body: string
  timestamp: string
  fieldChanges?: { field: string; from: string; to: string }[]
}

export interface Notification {
  id: string
  title: string
  body: string
  timestamp: string
  read: boolean
  type: "assignment" | "approval" | "sla" | "mention" | "system"
  href: string
}

export interface Approval {
  id: string
  recordNumber: string
  recordType: "Change" | "Request" | "Knowledge"
  shortDescription: string
  requestedById: string
  approverId: string
  state: ApprovalState
  requested: string
  due: string
}

/* -------------------------------------------------------------------------- */
/* Agent Operations                                                            */
/* -------------------------------------------------------------------------- */

export type AgentFramework = "LangGraph" | "LangChain" | "Custom"
/**
 * Where a release can land. `AgentEnvironment` is the subset a deployed agent
 * record can currently point at; `KeyEnvironment` (providers) reuses it.
 */
export type DeploymentEnvironment =
  "production" | "staging" | "development" | "shadow"
export type AgentEnvironment = Extract<
  DeploymentEnvironment,
  "production" | "staging"
>
/** Connection health of an external dependency (model provider, MCP server). */
export type ConnectionStatus = "Connected" | "Degraded" | "Disconnected"
/** Shared three-level severity for drift signals and guardrail violations. */
export type Severity = "Info" | "Warning" | "Critical"
/** A/B experiment arm. */
export type VariantKey = "A" | "B"
export type AgentHealth = "Healthy" | "Degraded" | "Drifting" | "Paused"
export type GraphNodeType =
  "router" | "llm" | "retriever" | "tool" | "human" | "guard" | "chain"

export interface GraphNode {
  id: string
  label: string
  type: GraphNodeType
  /** Downstream node ids. */
  next: string[]
}

export interface AgentMetrics {
  requests24h: number
  p50Ms: number
  p95Ms: number
  /** 0 to 100 */
  errorRate: number
  /** Composite evaluator score, 0 to 100. */
  quality: number
  /** 0 to 100, share of answers marked unhelpful. */
  thumbsDownRate: number
  costPerDay: number
  tokens24h: number
  /** Share of traffic sampled into the human review queue, 0 to 100. */
  reviewRate: number
}

/** Reasoning/thinking budget exposed by modern models. */
export type ReasoningEffort = "none" | "low" | "medium" | "high"

/**
 * Generation + agent-loop parameters. Shared by deployed agents, prompt
 * versions, the playground and experiments so one editor can configure all.
 */
export interface ModelParams {
  /** 0 to 2; sampling temperature. */
  temperature: number
  /** 0 to 1; nucleus sampling. */
  topP: number
  maxOutputTokens: number
  reasoningEffort: ReasoningEffort
  stopSequences: string[]
  toolChoice: "auto" | "required" | "none"
  parallelToolCalls: boolean
  responseFormat: "text" | "json_schema"
  seed?: number
  frequencyPenalty?: number
  presencePenalty?: number
  /** Per-request timeout. */
  timeoutMs: number
  /** Hard cap on tool calls per run (agent-loop budget). */
  maxToolCalls: number
  maxRetries: number
}

/** Hard bounds on a single agent run; the loop stops when any is hit. */
export interface RunLimits {
  maxSteps: number
  deadlineMs: number
  costBudgetUsd: number
  /** Consecutive steps without new tool output or state change before abort. */
  noProgressSteps: number
}

/** Fleet-wide emergency controls, toggled from the fleet overview. */
export interface FleetControls {
  /** Stops every agent from accepting new runs. */
  killSwitch: boolean
  /** Agents keep answering but every write-capable tool is blocked. */
  writesDisabled: boolean
  changedAt: string
  changedBy: string
}

/** SLO targets per agent. Availability / quality / safeCompletion are 0 to 100. */
export interface AgentSlo {
  availability: number
  p95Ms: number
  quality: number
  safeCompletion: number
}

export interface ErrorBudget {
  /** Share of the error budget still unspent, 0 to 1. */
  remaining: number
  /** Burn rate over the last hour; 1 = spending exactly on pace. */
  burnRate1h: number
  burnRate6h: number
  window: "28d"
}

export interface DeployedAgent {
  id: string
  name: string
  description: string
  team: string
  ownerId: string
  framework: AgentFramework
  version: string
  environment: AgentEnvironment
  /** OpenRouter-style model id, e.g. `anthropic/claude-sonnet-5.5`. */
  modelId: string
  fallbackModelId?: string
  health: AgentHealth
  tools: string[]
  graph: GraphNode[]
  metrics: AgentMetrics
  /** 14-day quality score history. */
  qualityTrend: number[]
  /** 14-day request volume history. */
  trafficTrend: number[]
  /** Population stability index of inputs vs the baseline window, 0 to 1. */
  driftScore: number
  lastDeployed: string
  evalDataset: string
  /** Semantic-layer entities the agent is allowed to query. */
  semanticEntityIds: string[]
  promptVersion: string
  /** Generation and agent-loop parameters currently deployed. */
  params: ModelParams
  limits: RunLimits
  /** Manually paused: no new runs are accepted until resumed. */
  paused: boolean
  pausedReason?: string
  slo: AgentSlo
  errorBudget: ErrorBudget
}

export type SpanStatus = "ok" | "error" | "skipped"
export type FinishReason =
  "stop" | "length" | "tool_calls" | "content_filter" | "error"

export interface TraceSpan {
  id: string
  parentId?: string
  name: string
  type: GraphNodeType
  /** Offset from trace start in ms. */
  startMs: number
  durationMs: number
  status: SpanStatus
  modelId?: string
  /** Why the model stopped generating (LLM spans only). */
  finishReason?: FinishReason
  /** Model alias the agent asked for, e.g. `anthropic/claude-sonnet`. */
  requestedModelId?: string
  /** Concrete model the provider served; differs when an alias resolved. */
  responseModelId?: string
  tokensIn?: number
  tokensOut?: number
  cost?: number
  input?: string
  output?: string
  attributes?: Record<string, string | number | boolean>
}

export type TraceStatus = "Succeeded" | "Failed" | "Needs review" | "Reviewed"
export type TraceChannel = "Web" | "Slack" | "Teams" | "API" | "Email"

/**
 * What actually happened to the run, finer than `TraceStatus`, which is the
 * review-workflow state. `refused` and `partial` are still "ok" runs.
 */
export type TraceOutcome =
  | "completed"
  | "partial"
  | "refused"
  | "invalid_output"
  | "tool_error"
  | "timeout"
  | "rate_limited"
  | "abandoned"

/** Which `RunLimits` bound ended the run, when one did. */
export type BoundHit = "max_steps" | "deadline" | "cost_budget" | "no_progress"

/** Everything needed to reproduce a run exactly. */
export interface TraceLineage {
  codeSha: string
  promptVersion: string
  paramsHash: string
  indexBuildId?: string
  toolSchemaVersions?: Record<string, string>
  policyVersion: string
}

export interface TraceStreaming {
  /** Time to first token. */
  ttftMs: number
  tokensPerSec: number
  /** Client went away before the stream finished. */
  disconnected: boolean
  /** Stream was cut short (length limit, disconnect or kill switch). */
  truncated: boolean
}

export interface AgentTrace {
  id: string
  agentId: string
  startedAt: string
  durationMs: number
  status: TraceStatus
  outcome: TraceOutcome
  boundHit?: BoundHit
  channel: TraceChannel
  sessionId: string
  userQuery: string
  finalAnswer: string
  tokensIn: number
  tokensOut: number
  cost: number
  modelId: string
  version: string
  userFeedback?: "up" | "down"
  /** Evaluator scores, 0 to 1. */
  evals: { grounded: number; helpful: number; safe: number }
  flags: string[]
  spans: TraceSpan[]
  lineage: TraceLineage
  /** Present for channels that stream the answer (Web, Slack, Teams). */
  streaming?: TraceStreaming
  experimentId?: string
  variant?: VariantKey
}

export type ReviewReason =
  | "Low confidence"
  | "User thumbs-down"
  | "Evaluator flag"
  | "Random sample"
  | "Policy match"
export type ReviewStatus = "Pending" | "Approved" | "Flagged" | "Corrected"

export interface ReviewRubric {
  accuracy: number
  grounding: number
  tone: number
  safety: number
}

export interface ReviewItem {
  id: string
  traceId: string
  agentId: string
  reason: ReviewReason
  priority: Priority
  status: ReviewStatus
  created: string
  assignedToId?: string
  reviewerId?: string
  rubric?: ReviewRubric
  correction?: string
  note?: string
}

export type DriftKind = "input" | "output" | "quality" | "tool" | "cost"
export type DriftSeverity = Severity
export type DriftState = "Open" | "Acknowledged" | "Resolved"

export interface DriftSignal {
  id: string
  agentId: string
  kind: DriftKind
  metric: string
  baseline: number
  current: number
  unit: string
  severity: DriftSeverity
  state: DriftState
  detected: string
  explanation: string
  /** 14-day history of the metric. */
  history: number[]
}

export type ExperimentKind = "model" | "prompt" | "retrieval" | "tooling"
export type ExperimentStatus =
  "Draft" | "Running" | "Completed" | "Promoted" | "Stopped"
export type ExperimentMetric = "quality" | "cost" | "latency"

export interface ExperimentVariant {
  key: VariantKey
  label: string
  modelId?: string
  promptVersion?: string
  requests: number
  quality: number
  p95Ms: number
  costPer1k: number
  thumbsUp: number
  errorRate: number
}

export interface Experiment {
  id: string
  name: string
  agentId: string
  hypothesis: string
  kind: ExperimentKind
  status: ExperimentStatus
  /** Share of traffic routed to variant B, 0 to 100. */
  split: number
  primaryMetric: ExperimentMetric
  started: string
  ends?: string
  ownerId: string
  variants: [ExperimentVariant, ExperimentVariant]
  /** Probability that B beats A on the primary metric, 0 to 1. */
  significance: number
  winner?: VariantKey
  /** Daily primary-metric readings for each variant. */
  daily: { name: string; A: number; B: number }[]
}

export type RecommendationKind =
  "cost" | "quality" | "latency" | "deprecation" | "context"
export type RecommendationStatus = "New" | "Testing" | "Applied" | "Dismissed"

export interface ModelRecommendation {
  id: string
  agentId: string
  kind: RecommendationKind
  title: string
  summary: string
  fromModelId: string
  toModelId: string
  evidence: { metric: string; from: string; to: string; good: boolean }[]
  /** 0 to 1 */
  confidence: number
  savingsPerMonth?: number
  status: RecommendationStatus
  created: string
  experimentId?: string
}

export type SemanticKind = "metric" | "dimension" | "entity" | "glossary"
export type SemanticStatus =
  "Verified" | "Draft" | "Needs review" | "Deprecated"
export type SemanticDomain =
  "ITSM" | "Operations" | "HR" | "Finance" | "Customer" | "Product"

export interface SemanticEntity {
  id: string
  name: string
  kind: SemanticKind
  domain: SemanticDomain
  definition: string
  formula?: string
  sources: string[]
  synonyms: string[]
  ownerId: string
  status: SemanticStatus
  usedByAgentIds: string[]
  queries30d: number
  lastVerified?: string
  issues: string[]
}
