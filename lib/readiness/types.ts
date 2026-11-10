/**
 * Readiness Assessment: shared types.
 *
 * A *control set* is the swappable catalog (domains + controls + framework
 * tags). An *assessment* is one team's answers against a control set for one
 * system profile. Everything here is plain JSON-serialisable so assessments
 * can be exported, URL-encoded and re-imported without a backend.
 */

export type DomainId =
  | "visibility"
  | "quality"
  | "drift"
  | "safety"
  | "cost-performance"
  | "governance"

export type ControlStatus =
  "none" | "planned" | "partial" | "in-place" | "verified"

export const controlStatuses: ControlStatus[] = [
  "none",
  "planned",
  "partial",
  "in-place",
  "verified",
]

export type SystemType = "chatbot" | "rag" | "agent" | "multi-agent"
export type AutonomyLevel = "assist" | "supervised" | "autonomous"
export type DataSensitivity =
  "public" | "internal" | "confidential" | "regulated"
export type UserExposure = "internal" | "external"
export type RegulatoryScope =
  "eu-ai-act" | "gdpr" | "hipaa" | "pci-dss" | "soc2" | "iso-42001"
export type MaturityTarget = "prototype" | "pilot" | "production"
export type MaturityLevel = "ad-hoc" | "defined" | "managed" | "optimized"
export type Effort = "low" | "medium" | "high"
export type Applicability = "applies" | "reduced" | "not-applicable"
export type FrameworkId = "owasp" | "nist" | "eu-ai-act" | "otel" | "iso-42001"

export const systemTypes: SystemType[] = [
  "chatbot",
  "rag",
  "agent",
  "multi-agent",
]
export const autonomyLevels: AutonomyLevel[] = [
  "assist",
  "supervised",
  "autonomous",
]
export const dataSensitivities: DataSensitivity[] = [
  "public",
  "internal",
  "confidential",
  "regulated",
]
export const userExposures: UserExposure[] = ["internal", "external"]
export const regulatoryScopes: RegulatoryScope[] = [
  "eu-ai-act",
  "gdpr",
  "hipaa",
  "pci-dss",
  "soc2",
  "iso-42001",
]
export const maturityTargets: MaturityTarget[] = [
  "prototype",
  "pilot",
  "production",
]
export const maturityLevels: MaturityLevel[] = [
  "ad-hoc",
  "defined",
  "managed",
  "optimized",
]

export interface SystemProfile {
  name: string
  systemType: SystemType
  autonomy: AutonomyLevel
  dataSensitivity: DataSensitivity
  exposure: UserExposure
  regulatory: RegulatoryScope[]
}

/**
 * When a control should count. Every listed condition must hold; when one
 * fails the control becomes `otherwise` (default: not applicable → hidden).
 */
export interface ApplicabilityRule {
  systemTypes?: SystemType[]
  minAutonomy?: AutonomyLevel
  minSensitivity?: DataSensitivity
  exposure?: UserExposure[]
  /** Applies when the profile declares *any* of these scopes. */
  regulatory?: RegulatoryScope[]
  otherwise?: Exclude<Applicability, "applies">
}

export interface FrameworkRefs {
  owasp?: string[]
  nist?: string[]
  euAiAct?: string[]
  otel?: string[]
  iso42001?: string[]
}

export type CadenceInterval = "weekly" | "monthly" | "quarterly" | "semiannual"

export interface Cadence {
  every: CadenceInterval
  /** What the periodic activity is, e.g. "Refresh the eval set". */
  label: string
}

export interface LinkRef {
  label: string
  href: string
}

export interface ControlDef {
  /** Stable, human-readable id such as `VIS-01`. */
  id: string
  domain: DomainId
  title: string
  /** What the control is. */
  what: string
  /** Why it matters: the failure it prevents. */
  why: string
  /** Implementation steps. */
  how: string[]
  /** The "done looks like" test an auditor could run. */
  done: string
  /** 1 (nice to have) … 5 (critical). Drives weighting and gap severity. */
  risk: 1 | 2 | 3 | 4 | 5
  effort: Effort
  /** Earliest maturity stage at which this control is required. */
  requiredAt: MaturityTarget
  /** Release-gate control: blocks go-live when required and not in place. */
  gate?: boolean
  applicability?: ApplicabilityRule
  frameworks: FrameworkRefs
  /** Tool ids from the tool matrix. */
  tools: string[]
  /** Metric ids from the metric catalog. */
  metrics?: string[]
  /** Snippet ids from the instrumentation library. */
  snippets?: string[]
  cadence?: Cadence
  learnMore?: LinkRef[]
}

export interface DomainDef {
  id: DomainId
  title: string
  short: string
  description: string
  /** CSS color token, e.g. `var(--chart-1)`. */
  color: string
}

export interface ControlSet {
  id: string
  name: string
  version: string
  description: string
  domains: DomainDef[]
  controls: ControlDef[]
}

export interface ControlResponse {
  status: ControlStatus
  ownerId?: string
  tool?: string
  evidence?: string
  /** ISO date of the last review. */
  lastReviewed?: string
  notes?: string
  /** Team mode: one answer per respondent name. */
  votes?: Record<string, ControlStatus>
}

export interface Assessment {
  id: string
  name: string
  controlSetId: string
  controlSetVersion: string
  profile: SystemProfile
  target: MaturityTarget
  responses: Record<string, ControlResponse>
  respondents: string[]
  createdAt: string
  updatedAt: string
}

export interface Snapshot {
  id: string
  label: string
  takenAt: string
  assessment: Assessment
}

// ---- Scoring outputs -------------------------------------------------------

export interface ControlEval {
  control: ControlDef
  response: ControlResponse
  applicability: Applicability
  /** Effective weight after applicability and stage adjustments. */
  weight: number
  /** 0 to 1 credit for the current status. */
  credit: number
  /** Required at the assessment's maturity target. */
  required: boolean
  /** Required gate control that is not yet in place. */
  blocker: boolean
  /** 0 to 100, higher = fix first. */
  severity: number
  /** Review due state derived from `cadence` and `lastReviewed`. */
  review?: { dueAt: string; overdue: boolean }
}

export interface DomainScore {
  domain: DomainDef
  score: number
  applicable: number
  inPlace: number
  verified: number
  required: number
  requiredMet: number
  blockers: number
}

export interface AssessmentResult {
  overall: number
  maturity: MaturityLevel
  domains: DomainScore[]
  controls: ControlEval[]
  gaps: ControlEval[]
  blockers: ControlEval[]
  reviews: ControlEval[]
  counts: Record<ControlStatus, number> & { hidden: number; applicable: number }
}

// ---- Catalogs ---------------------------------------------------------------

export interface ToolDef {
  id: string
  name: string
  kind: "open-source" | "managed" | "both"
  url: string
  summary: string
  domains: DomainId[]
}

export interface MetricDef {
  id: string
  name: string
  domain: DomainId
  formula: string
  unit: string
  direction: "higher-is-better" | "lower-is-better"
  warn: number
  crit: number
  /** OTel attribute or metric name the value is derived from. */
  otel?: string
}

export interface SnippetDef {
  id: string
  title: string
  language: "python" | "typescript" | "yaml" | "json"
  description: string
  code: string
}

export interface FailureMode {
  id: string
  title: string
  summary: string
  /** Public incident the pattern is drawn from, when there is one. */
  realWorld?: string
  domain: DomainId
  /** Controls that would have caught or contained it. */
  controls: string[]
}

export interface GlossaryEntry {
  term: string
  definition: string
  href?: string
}

export interface FrameworkDef {
  id: FrameworkId
  name: string
  short: string
  url: string
  items: { id: string; title: string }[]
}
