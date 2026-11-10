import type { DeployedAgent } from "@/lib/types"
import {
  formatVersion,
  gateFromRun,
  parseVersion,
  releaseApprovals,
  releases,
  timeToPromoteHours,
  type Approver,
  type EvalGate,
  type Release,
  type ReleaseApproval,
  type ReleaseChange,
} from "@/lib/data/deployments"
import type { EvalRun } from "@/lib/data/evals"
import { guardrailCoverage } from "@/lib/data/guardrails"
import { clock, NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { createListStore, createStore } from "@/lib/store"
import { recordAudit } from "../audit/audit-store"

const DAY = 86_400_000

/**
 * One list of releases for the whole Deployments slice: the releases table,
 * the stat cards, the approvals inbox and the release record all read it, so
 * approving, rolling back or drafting a release moves every number. Releases
 * drafted in this session (from an eval run or the environments matrix) live
 * here too and open on `/agentops/deployments/<id>` through the client-side
 * fallback in the record page.
 */
export const releaseStore = createListStore(releases, (r) => r.id)

export type ApprovalDecision = "approved" | "rejected" | "changes requested"

/** Approval decisions taken this session, keyed by approval id. */
export const decisionStore = createStore<{
  decisions: Record<string, ApprovalDecision>
}>({ decisions: {} })

export function decide(approvalId: string, decision: ApprovalDecision) {
  decisionStore.set((s) => ({
    decisions: { ...s.decisions, [approvalId]: decision },
  }))
}

/* -------------------------------------------------------------------------- */
/* Derived views                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Approval cards derive from releases in `Pending approval`, so a release
 * drafted or decided in this session is reflected immediately. Seeded
 * approvals keep their original evidence (experiment significance).
 */
export function approvalsFrom(list: Release[]): ReleaseApproval[] {
  return list
    .filter((r) => r.stage === "Pending approval")
    .map((r) => {
      const seeded = releaseApprovals.find((a) => a.releaseId === r.id)
      if (seeded) return { ...seeded, approvers: r.approvers }
      const requested = r.createdAt
      return {
        id: `apr-${r.id.slice(4)}`,
        releaseId: r.id,
        risk: r.risk,
        requestedAt: requested,
        due: new Date(new Date(requested).getTime() + 2 * DAY).toISOString(),
        evidence: {
          evalGate: r.evalGate,
          guardrailCoverage: r.guardrailCoverage,
          costDeltaPct: r.costDeltaPct,
        },
        approvers: r.approvers,
      }
    })
}

/** Stat row figures for the Deployments page, from the client list. */
export function deploymentStats(list: Release[]) {
  const since7 = new Date(NOW.getTime() - 7 * DAY).toISOString()
  const since30 = new Date(NOW.getTime() - 30 * DAY).toISOString()
  const deploys7d = list.filter((r) => r.deployedAt && r.deployedAt >= since7)
  const drafted7d = list.filter((r) => r.createdAt >= since7)
  const finished30d = list.filter(
    (r) =>
      r.completedAt &&
      r.completedAt >= since30 &&
      (r.stage === "Promoted" ||
        r.stage === "Rolled back" ||
        r.stage === "Failed")
  )
  const promoted30d = finished30d.filter((r) => r.stage === "Promoted")
  const rollbacks30d = finished30d.filter((r) => r.stage === "Rolled back")
  const failed30d = finished30d.filter((r) => r.stage === "Failed")
  const successRate = finished30d.length
    ? Math.round((promoted30d.length / finished30d.length) * 100)
    : 100
  const canaries = list.filter(
    (r) => r.stage === "Canary" || r.stage === "Progressing"
  )
  const promoteHours = list
    .map(timeToPromoteHours)
    .filter((h): h is number => h !== null)
  const meanPromoteHours =
    promoteHours.reduce((a, b) => a + b, 0) / Math.max(1, promoteHours.length)
  return {
    deploys7d: deploys7d.length,
    drafted7d: drafted7d.length,
    successRate,
    promoted30d: promoted30d.length,
    finished30d: finished30d.length,
    canaries,
    rollbacks30d: rollbacks30d.length,
    failed30d: failed30d.length,
    meanPromoteHours,
  }
}

/* -------------------------------------------------------------------------- */
/* Drafting releases                                                           */
/* -------------------------------------------------------------------------- */

function nextReleaseId(list: Release[]) {
  const max = list.reduce(
    (m, r) => Math.max(m, Number(r.id.replace(/^rel-/, "")) || 0),
    1000
  )
  return `rel-${max + 1}`
}

function nextVersion(current: string, minor: boolean) {
  const [a, b, c] = parseVersion(current)
  return formatVersion(minor ? [a, b + 1, 0] : [a, b, c + 1])
}

/** Same rule as the data module: model changes are High, tools and retrieval Moderate, else Low. */
function riskFor(changes: ReleaseChange[]): Release["risk"] {
  if (changes.some((c) => c.kind === "model")) return "High"
  if (changes.some((c) => c.kind === "tools" || c.kind === "retrieval"))
    return "Moderate"
  return "Low"
}

/**
 * Approver roster for a new release. Reuses the roster of the agent's most
 * recent release at the same risk level so roles match the seed, and falls
 * back to the agent owner alone.
 */
function approversFor(agent: DeployedAgent, risk: Release["risk"]): Approver[] {
  const template =
    releases.find((r) => r.agentId === agent.id && r.risk === risk) ??
    releases.find((r) => r.agentId === agent.id)
  const roster: Approver[] = template
    ? template.approvers.map((a) => ({
        userId: a.userId,
        role: a.role,
        status: "pending",
      }))
    : []
  if (!roster.some((a) => a.userId === agent.ownerId))
    roster.unshift({
      userId: agent.ownerId,
      role: "Agent owner",
      status: "pending",
    })
  return roster
}

interface DraftInput {
  agent: DeployedAgent
  changes: ReleaseChange[]
  summary: string
  evalGate?: EvalGate
  /** Version that becomes `previousVersion` and `rollbackTarget`. */
  from: string
  /** Prompt version the draft ships, used by the environments matrix. */
  experimentId?: string
  origin: string
}

function draft(input: DraftInput): Release {
  const list = releaseStore.get()
  const now = clock().toISOString()
  const id = nextReleaseId(list)
  const risk = riskFor(input.changes)
  const gateOk = input.evalGate?.status === "passed"
  const release: Release = {
    id,
    agentId: input.agent.id,
    version: nextVersion(
      input.from,
      input.changes.some((c) => c.kind === "model")
    ),
    previousVersion: input.from,
    environment: "production",
    strategy: "Canary",
    steps: [5, 25, 100],
    stage: gateOk ? "Pending approval" : "Draft",
    summary: input.summary,
    changes: input.changes,
    evalGate: input.evalGate,
    traffic: 0,
    health: { errorRateDelta: 0, qualityDelta: 0 },
    risk,
    guardrailCoverage: guardrailCoverage(input.agent.id).score,
    costDeltaPct: 0,
    deployedById: currentUser.id,
    approvers: approversFor(input.agent, risk),
    experimentId: input.experimentId,
    createdAt: now,
    rollbackTarget: input.from,
    rollout: [],
    activity: [
      {
        id: `${id}-created`,
        kind: "created",
        at: now,
        actorId: currentUser.id,
        message: `Drafted from ${input.origin}`,
      },
      ...(input.evalGate
        ? [
            {
              id: `${id}-eval`,
              kind: "eval" as const,
              at: now,
              actorId: currentUser.id,
              message: gateOk
                ? `Eval gate passed on ${input.evalGate.runId}: composite ${input.evalGate.score} against ${input.evalGate.threshold}`
                : `Eval gate failed on ${input.evalGate.runId}: ${input.evalGate.reason}`,
            },
          ]
        : []),
    ],
  }
  releaseStore.add(release, "start")
  recordAudit({
    action: "release.created",
    source: "release",
    target: {
      kind: "release",
      id: release.id,
      label: `${input.agent.name} ${release.version}`,
      href: `/agentops/deployments/${release.id}`,
    },
    summary: `Drafted ${release.id} (${input.agent.name} ${release.previousVersion} to ${release.version}) from ${input.origin}`,
    context: {
      agentId: input.agent.id,
      releaseId: release.id,
      promptVersion: input.changes.find((c) => c.kind === "prompt")?.after,
      modelId: input.changes.find((c) => c.kind === "model")?.after,
    },
  })
  return release
}

/** "Promote to production" on an eval run: a canary release gated on that run. */
export function draftReleaseFromRun(run: EvalRun, agent: DeployedAgent) {
  const changes: ReleaseChange[] = []
  if (run.promptVersion !== agent.promptVersion)
    changes.push({
      kind: "prompt",
      field: "Prompt",
      before: agent.promptVersion,
      after: run.promptVersion,
    })
  if (run.modelId !== agent.modelId)
    changes.push({
      kind: "model",
      field: "Model",
      before: agent.modelId,
      after: run.modelId,
    })
  return draft({
    agent,
    changes,
    summary: `Promote the ${run.id} candidate: ${changes.map((c) => `${c.field.toLowerCase()} ${c.before} to ${c.after}`).join(", ")}`,
    evalGate: gateFromRun(run),
    from: agent.version,
    origin: `eval run ${run.id}`,
  })
}

/** "Promote to prod" on the environments matrix: staging over production. */
export function draftReleaseFromStaging(input: {
  agent: DeployedAgent
  production: { version: string; modelId: string; promptVersion: string }
  staging: { version: string; modelId: string; promptVersion: string }
  gateRun?: EvalRun
}) {
  const { agent, production, staging } = input
  const changes: ReleaseChange[] = []
  if (staging.promptVersion !== production.promptVersion)
    changes.push({
      kind: "prompt",
      field: "Prompt",
      before: production.promptVersion,
      after: staging.promptVersion,
    })
  if (staging.modelId !== production.modelId)
    changes.push({
      kind: "model",
      field: "Model",
      before: production.modelId,
      after: staging.modelId,
    })
  return draft({
    agent,
    changes,
    summary: `Promote staging ${staging.version} to production`,
    evalGate: input.gateRun ? gateFromRun(input.gateRun) : undefined,
    from: production.version,
    origin: `staging ${staging.version}`,
  })
}
