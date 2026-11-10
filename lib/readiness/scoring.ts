import { NOW } from "@/lib/data/seed"

import type {
  Applicability,
  Assessment,
  AssessmentResult,
  AutonomyLevel,
  CadenceInterval,
  ControlDef,
  ControlEval,
  ControlResponse,
  ControlSet,
  ControlStatus,
  DataSensitivity,
  DomainScore,
  Effort,
  MaturityLevel,
  MaturityTarget,
  SystemProfile,
} from "./types"

/** Credit awarded per status, 0 to 1. */
export const statusCredit: Record<ControlStatus, number> = {
  none: 0,
  planned: 0.15,
  partial: 0.5,
  "in-place": 0.85,
  verified: 1,
}

const stageIndex: Record<MaturityTarget, number> = {
  prototype: 0,
  pilot: 1,
  production: 2,
}
const autonomyIndex: Record<AutonomyLevel, number> = {
  assist: 0,
  supervised: 1,
  autonomous: 2,
}
const sensitivityIndex: Record<DataSensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  regulated: 3,
}
export const effortOrder: Record<Effort, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

const applicabilityFactor: Record<Applicability, number> = {
  applies: 1,
  reduced: 0.5,
  "not-applicable": 0,
}

const cadenceDays: Record<CadenceInterval, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  semiannual: 182,
}

export const emptyResponse: ControlResponse = { status: "none" }

export function isRequired(control: ControlDef, target: MaturityTarget) {
  return stageIndex[control.requiredAt] <= stageIndex[target]
}

export function applicabilityOf(
  control: ControlDef,
  profile: SystemProfile
): Applicability {
  const rule = control.applicability
  if (!rule) return "applies"
  const fails =
    (rule.systemTypes && !rule.systemTypes.includes(profile.systemType)) ||
    (rule.minAutonomy &&
      autonomyIndex[profile.autonomy] < autonomyIndex[rule.minAutonomy]) ||
    (rule.minSensitivity &&
      sensitivityIndex[profile.dataSensitivity] <
        sensitivityIndex[rule.minSensitivity]) ||
    (rule.exposure && !rule.exposure.includes(profile.exposure)) ||
    (rule.regulatory &&
      !rule.regulatory.some((r) => profile.regulatory.includes(r)))
  return fails ? (rule.otherwise ?? "not-applicable") : "applies"
}

/** True when the status counts as implemented for gates. */
export function isMet(status: ControlStatus) {
  return status === "in-place" || status === "verified"
}

export function reviewState(control: ControlDef, response: ControlResponse) {
  if (!control.cadence) return undefined
  if (response.status === "none" || response.status === "planned")
    return undefined
  const days = cadenceDays[control.cadence.every]
  const base = response.lastReviewed
    ? new Date(response.lastReviewed).getTime()
    : undefined
  const dueAt = base === undefined ? NOW.getTime() : base + days * 86_400_000
  return {
    dueAt: new Date(dueAt).toISOString(),
    overdue: dueAt <= NOW.getTime(),
  }
}

export function evaluateControl(
  control: ControlDef,
  assessment: Assessment
): ControlEval {
  const response = assessment.responses[control.id] ?? emptyResponse
  const applicability = applicabilityOf(control, assessment.profile)
  const required = isRequired(control, assessment.target)
  const credit = statusCredit[response.status]
  const weight =
    control.risk * applicabilityFactor[applicability] * (required ? 1 : 0.5)
  const blocker =
    applicability !== "not-applicable" &&
    Boolean(control.gate) &&
    required &&
    !isMet(response.status)
  const severityRaw =
    (control.risk / 5) *
    (1 - credit) *
    (required ? 1 : 0.6) *
    (control.gate ? 1.15 : 1) *
    applicabilityFactor[applicability]
  return {
    control,
    response,
    applicability,
    weight,
    credit,
    required,
    blocker,
    severity: Math.round(Math.min(1, severityRaw) * 100),
    review: reviewState(control, response),
  }
}

export function maturityFor(
  overall: number,
  requiredEvals: ControlEval[]
): MaturityLevel {
  if (overall < 40) return "ad-hoc"
  if (overall < 65) return "defined"
  if (overall < 85) return "managed"
  const verified = requiredEvals.filter(
    (e) => e.response.status === "verified"
  ).length
  return requiredEvals.length > 0 && verified / requiredEvals.length >= 0.5
    ? "optimized"
    : "managed"
}

function weightedScore(evals: ControlEval[]) {
  const total = evals.reduce((acc, e) => acc + e.weight, 0)
  if (total === 0) return 0
  return Math.round(
    (evals.reduce((acc, e) => acc + e.weight * e.credit, 0) / total) * 100
  )
}

export function evaluateAssessment(
  assessment: Assessment,
  set: ControlSet
): AssessmentResult {
  const controls = set.controls.map((c) => evaluateControl(c, assessment))
  const applicable = controls.filter(
    (e) => e.applicability !== "not-applicable"
  )
  const domains: DomainScore[] = set.domains.map((domain) => {
    const own = applicable.filter((e) => e.control.domain === domain.id)
    const required = own.filter((e) => e.required)
    return {
      domain,
      score: weightedScore(own),
      applicable: own.length,
      inPlace: own.filter((e) => isMet(e.response.status)).length,
      verified: own.filter((e) => e.response.status === "verified").length,
      required: required.length,
      requiredMet: required.filter((e) => isMet(e.response.status)).length,
      blockers: own.filter((e) => e.blocker).length,
    }
  })
  const overall = weightedScore(applicable)
  const gaps = applicable
    .filter((e) => !isMet(e.response.status))
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        effortOrder[a.control.effort] - effortOrder[b.control.effort] ||
        a.control.id.localeCompare(b.control.id)
    )
  const blockers = applicable
    .filter((e) => e.blocker)
    .sort((a, b) => b.severity - a.severity)
  const reviews = applicable
    .filter(
      (e): e is ControlEval & { review: NonNullable<ControlEval["review"]> } =>
        e.review !== undefined
    )
    .sort((a, b) => a.review.dueAt.localeCompare(b.review.dueAt))
  const counts = {
    none: 0,
    planned: 0,
    partial: 0,
    "in-place": 0,
    verified: 0,
    hidden: controls.length - applicable.length,
    applicable: applicable.length,
  }
  for (const e of applicable) counts[e.response.status]++
  return {
    overall,
    maturity: maturityFor(
      overall,
      applicable.filter((e) => e.required)
    ),
    domains,
    controls,
    gaps,
    blockers,
    reviews,
    counts,
  }
}

/** Majority vote across respondents; ties resolve to the lower status. */
export function consensusStatus(
  votes: Record<string, ControlStatus> | undefined
): ControlStatus | undefined {
  if (!votes) return undefined
  const entries = Object.values(votes)
  if (entries.length === 0) return undefined
  const tally = new Map<ControlStatus, number>()
  for (const v of entries) tally.set(v, (tally.get(v) ?? 0) + 1)
  const order: ControlStatus[] = [
    "none",
    "planned",
    "partial",
    "in-place",
    "verified",
  ]
  let best: ControlStatus = order[0]
  let bestCount = -1
  for (const s of order) {
    const n = tally.get(s) ?? 0
    if (n > bestCount) {
      best = s
      bestCount = n
    }
  }
  return best
}

/** Respondents disagree when votes span more than one adjacent status. */
export function voteSpread(
  votes: Record<string, ControlStatus> | undefined
): number {
  if (!votes) return 0
  const order: ControlStatus[] = [
    "none",
    "planned",
    "partial",
    "in-place",
    "verified",
  ]
  const idx = Object.values(votes).map((v) => order.indexOf(v))
  if (idx.length < 2) return 0
  return Math.max(...idx) - Math.min(...idx)
}
