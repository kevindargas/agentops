/**
 * Deployments & releases: change management for the agent fleet.
 *
 * Everything is derived deterministically from `deployedAgents` (seed 7901) so
 * the latest promoted production release of every agent is exactly the version,
 * model and prompt the agent currently runs. Releases ids use the `rel-` prefix.
 */

import type { ChangeRisk, DeploymentEnvironment } from "@/lib/types"
import { deployedAgents, experiments } from "./agentops"
import { evalRuns, type EvalRun } from "./evals"
import { getPromptForAgent, getPromptVersion } from "./prompts"
import { chance, createRng, int, NOW, pick, type Rng } from "./seed"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type ReleaseStage =
  | "Draft"
  | "Pending approval"
  | "Canary"
  | "Progressing"
  | "Promoted"
  | "Rolled back"
  | "Failed"

export type ReleaseStrategy = "Canary" | "Blue-green" | "Shadow" | "Direct"

/** Same vocabulary as `DeploymentEnvironment` in `lib/types.ts`. */
export type ReleaseEnvironment = DeploymentEnvironment

export type ReleaseChangeKind =
  "prompt" | "model" | "tools" | "params" | "retrieval"

export interface ReleaseChange {
  kind: ReleaseChangeKind
  /** Field label, e.g. "Prompt", "Model", "temperature", "top_k". */
  field: string
  before: string
  after: string
}

export type EvalGateStatus = "passed" | "failed" | "pending"

export interface EvalGate {
  status: EvalGateStatus
  /** Composite score on the agent's golden set, 0 to 100. */
  score: number
  threshold: number
  /** Eval run (`ev-...`) the gate was evaluated on. */
  runId: string
  /**
   * Why a gate failed when the composite alone does not explain it, e.g.
   * regressions on the golden set or a pass rate below the floor.
   */
  reason?: string
}

export interface RolloutPoint {
  /** ISO timestamp. */
  at: string
  /** Share of live traffic on the new version, 0 to 100. */
  traffic: number
  quality: number
  baselineQuality: number
  errorRate: number
  baselineErrorRate: number
}

export type ReleaseEventKind =
  | "created"
  | "eval"
  | "approval"
  | "deploy"
  | "advance"
  | "promote"
  | "rollback"
  | "fail"
  | "note"

export interface ReleaseEvent {
  id: string
  kind: ReleaseEventKind
  at: string
  actorId?: string
  message: string
}

export type ApproverStatus =
  "approved" | "pending" | "rejected" | "changes requested"

export interface Approver {
  userId: string
  role: string
  status: ApproverStatus
  /** Decision time; present once `status` is no longer `pending`. */
  at?: string
}

/** Approvers that have decided, with the decision time guaranteed. */
export function decidedApprovers(
  approvers: Approver[]
): (Approver & { at: string })[] {
  return approvers.filter(
    (a): a is Approver & { at: string } =>
      a.status !== "pending" && typeof a.at === "string"
  )
}

export interface Release {
  id: string
  agentId: string
  version: string
  previousVersion: string
  environment: ReleaseEnvironment
  strategy: ReleaseStrategy
  /** Traffic steps for the strategy, e.g. [5, 25, 100]. */
  steps: number[]
  stage: ReleaseStage
  summary: string
  changes: ReleaseChange[]
  evalGate?: EvalGate
  /** Current share of traffic on the new version, 0 to 100. */
  traffic: number
  /** Deltas vs the baseline version during the rollout. */
  health: { errorRateDelta: number; qualityDelta: number }
  risk: ChangeRisk
  /** Share of the agent's guardrail suite covering this change, 0 to 100. */
  guardrailCoverage: number
  /** Estimated change in cost per day, percent. */
  costDeltaPct: number
  deployedById: string
  approvers: Approver[]
  experimentId?: string
  createdAt: string
  deployedAt?: string
  completedAt?: string
  rollbackTarget: string
  rollout: RolloutPoint[]
  activity: ReleaseEvent[]
}

export interface EnvironmentState {
  agentId: string
  environment: ReleaseEnvironment
  version: string
  modelId: string
  promptVersion: string
  lastDeployedAt: string
  releaseId?: string
}

export interface ReleaseApproval {
  id: string
  releaseId: string
  risk: ChangeRisk
  requestedAt: string
  due: string
  evidence: {
    evalGate?: EvalGate
    experimentSignificance?: number
    guardrailCoverage: number
    costDeltaPct: number
  }
  approvers: Approver[]
}

/* -------------------------------------------------------------------------- */
/* Version helpers                                                             */
/* -------------------------------------------------------------------------- */

type Semver = [number, number, number]

export function parseVersion(v: string): Semver {
  const [a = 0, b = 0, c = 0] = v.replace(/^v/, "").split(".").map(Number)
  return [a, b, c]
}

export function formatVersion([a, b, c]: Semver) {
  return `v${a}.${b}.${c}`
}

export function compareVersions(a: string, b: string) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

function prevVersion(v: Semver, rng: Rng): Semver {
  const [a, b, c] = v
  if (c > 0) return [a, b, c - 1]
  if (b > 0) return [a, b - 1, int(rng, 0, 4)]
  return [Math.max(0, a - 1), int(rng, 1, 6), int(rng, 0, 3)]
}

function nextVersion(v: Semver, minor: boolean): Semver {
  const [a, b, c] = v
  return minor ? [a, b + 1, 0] : [a, b, c + 1]
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

const rng = createRng(7901)
const HOUR = 3_600_000
const DAY = 24 * HOUR
const QUARTER = 15 * 60_000

const iso = (ms: number) => new Date(ms).toISOString()

const stepsFor: Record<ReleaseStrategy, number[]> = {
  Canary: [5, 25, 100],
  "Blue-green": [0, 100],
  Shadow: [0],
  Direct: [100],
}

const modelPool = [
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-5.5",
  "anthropic/claude-fable-5.1",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.5",
  "openai/gpt-5-mini",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-flash-lite",
  "deepseek/deepseek-v3.2",
]

const retrievalFields: [string, string[]][] = [
  ["top_k", ["6", "8", "12", "16"]],
  ["chunk_size", ["512", "800", "1024"]],
  ["reranker", ["off", "cohere-rerank-3", "voyage-rerank-2"]],
  ["hybrid_search", ["off", "on"]],
]

const extraTools = [
  "lookup_customer",
  "legacy_search",
  "summarize_thread",
  "post_slack_message",
  "fetch_runbook",
]

const reasoningLevels = ["none", "low", "medium", "high"]

interface ConfigState {
  /** Prompt version id (`p-N`) from the agent's own registry entry. */
  prompt: string
  /** Every version id of the agent's system prompt, oldest first. */
  promptChain: string[]
  modelId: string
  temperature: number
  maxOutputTokens: number
  reasoningEffort: string
  maxToolCalls: number
  tools: string[]
  retrieval: Record<string, string>
}

/**
 * Walk a config state one release backwards (or forwards) and return the
 * change list that connects the two states. `dir = -1` mutates the "before"
 * state so the current state stays the agent's live configuration.
 */
function mutate(
  state: ConfigState,
  dir: -1 | 1,
  kinds: ReleaseChangeKind[]
): { next: ConfigState; changes: ReleaseChange[] } {
  const next: ConfigState = {
    ...state,
    tools: [...state.tools],
    retrieval: { ...state.retrieval },
  }
  const changes: ReleaseChange[] = []
  const emit = (
    kind: ReleaseChangeKind,
    field: string,
    current: string,
    other: string
  ) =>
    changes.push({
      kind,
      field,
      before: dir === -1 ? other : current,
      after: dir === -1 ? current : other,
    })

  for (const kind of kinds) {
    switch (kind) {
      case "prompt": {
        // Walk along the agent's own version chain; never invent an id.
        const idx = state.promptChain.indexOf(state.prompt)
        const other = state.promptChain[idx + dir]
        if (idx === -1 || !other) break
        emit("prompt", "Prompt", state.prompt, other)
        next.prompt = other
        break
      }
      case "model": {
        const other = pick(
          rng,
          modelPool.filter(
            (m) =>
              m !== state.modelId &&
              m.split("/")[0] === state.modelId.split("/")[0]
          )
        )
        emit("model", "Model", state.modelId, other)
        next.modelId = other
        break
      }
      case "params": {
        const which = int(rng, 0, 3)
        if (which === 0) {
          const other =
            Math.round(
              Math.min(
                1,
                Math.max(0, state.temperature + pick(rng, [-0.1, 0.1, 0.2]))
              ) * 10
            ) / 10
          if (other !== state.temperature) {
            emit(
              "params",
              "temperature",
              String(state.temperature),
              String(other)
            )
            next.temperature = other
          }
        } else if (which === 1) {
          const other =
            state.maxOutputTokens >= 4096
              ? state.maxOutputTokens / 2
              : state.maxOutputTokens * 2
          emit(
            "params",
            "maxOutputTokens",
            String(state.maxOutputTokens),
            String(other)
          )
          next.maxOutputTokens = other
        } else if (which === 2) {
          const i = reasoningLevels.indexOf(state.reasoningEffort)
          const other = reasoningLevels[i === 0 ? 1 : i - 1]
          emit("params", "reasoningEffort", state.reasoningEffort, other)
          next.reasoningEffort = other
        } else {
          const other = Math.max(2, state.maxToolCalls + pick(rng, [-2, 2, 4]))
          if (other !== state.maxToolCalls) {
            emit(
              "params",
              "maxToolCalls",
              String(state.maxToolCalls),
              String(other)
            )
            next.maxToolCalls = other
          }
        }
        break
      }
      case "tools": {
        if (chance(rng, 0.6)) {
          // The current state has a tool the other state lacks.
          const t = pick(rng, state.tools)
          emit("tools", "Tools", t, "")
          next.tools = next.tools.filter((x) => x !== t)
        } else {
          const t = pick(
            rng,
            extraTools.filter((x) => !state.tools.includes(x))
          )
          emit("tools", "Tools", "", t)
          next.tools.push(t)
        }
        break
      }
      case "retrieval": {
        const [field, values] = pick(rng, retrievalFields)
        const current = state.retrieval[field] ?? values[0]
        const other = pick(
          rng,
          values.filter((v) => v !== current)
        )
        emit("retrieval", field, current, other)
        next.retrieval[field] = other
        break
      }
    }
  }
  // A prompt step with nowhere to go leaves nothing to ship; fall back to a
  // parameter tweak so every release carries at least one change.
  if (changes.length === 0 && !kinds.includes("params"))
    return mutate(state, dir, ["params"])
  if (changes.length === 0) {
    emit("params", "maxRetries", "2", "3")
  }
  return { next, changes }
}

function pickKinds(): ReleaseChangeKind[] {
  const n = int(rng, 1, 3)
  const pool: ReleaseChangeKind[] = [
    "prompt",
    "prompt",
    "params",
    "params",
    "model",
    "tools",
    "retrieval",
  ]
  const out = new Set<ReleaseChangeKind>()
  while (out.size < n) out.add(pick(rng, pool))
  return [...out]
}

function summarize(changes: ReleaseChange[]) {
  const parts = changes.map((c) => {
    switch (c.kind) {
      case "prompt":
        return `prompt ${c.before} → ${c.after}`
      case "model":
        return `model ${c.before.split("/").pop()} → ${c.after.split("/").pop()}`
      case "tools":
        return c.before === "" ? `added ${c.after}` : `removed ${c.before}`
      case "params":
        return `${c.field} ${c.before} → ${c.after}`
      case "retrieval":
        return `retrieval ${c.field} ${c.before} → ${c.after}`
    }
  })
  const s = parts.join(", ")
  return changes[0].kind === "params" || changes[0].kind === "retrieval"
    ? s
    : s.charAt(0).toUpperCase() + s.slice(1)
}

function riskFor(changes: ReleaseChange[]): ChangeRisk {
  if (changes.some((c) => c.kind === "model")) return "High"
  if (changes.some((c) => c.kind === "tools" || c.kind === "retrieval"))
    return "Moderate"
  return "Low"
}

function approversFor(risk: ChangeRisk, ownerId: string): Approver[] {
  const list: Approver[] = [
    { userId: ownerId, role: "Agent owner", status: "pending" },
  ]
  if (risk !== "Low")
    list.push({ userId: "u-004", role: "Platform lead", status: "pending" })
  if (risk === "High" || risk === "Very High")
    list.push({ userId: "u-009", role: "AI governance", status: "pending" })
  return list
}

function buildRollout(
  start: number,
  end: number,
  steps: number[],
  baseQ: number,
  baseErr: number,
  qDelta: number,
  errDelta: number,
  stopAtStep: number
): RolloutPoint[] {
  const points: RolloutPoint[] = []
  const span = Math.max(HOUR, end - start)
  const n = Math.max(2, Math.min(24, Math.round(span / HOUR)))
  const visibleSteps = steps.slice(0, stopAtStep + 1)
  for (let i = 0; i <= n; i++) {
    const t = start + (span * i) / n
    const stepIdx = Math.min(
      visibleSteps.length - 1,
      Math.floor((i / (n + 1)) * steps.length)
    )
    const ramp = Math.min(1, (i + 1) / (n * 0.6))
    const noise = () => (rng() - 0.5) * 0.8
    points.push({
      at: iso(t),
      traffic: visibleSteps[stepIdx],
      quality: Math.round((baseQ + qDelta * ramp + noise()) * 10) / 10,
      baselineQuality: Math.round((baseQ + noise() * 0.4) * 10) / 10,
      errorRate:
        Math.round(
          Math.max(0, baseErr + errDelta * ramp + noise() * 0.3) * 100
        ) / 100,
      baselineErrorRate:
        Math.round(Math.max(0, baseErr + noise() * 0.15) * 100) / 100,
    })
  }
  return points
}

/* ---- eval gate runs -------------------------------------------------------- */

/** Composite score a release gate requires, 0-100. */
export const GATE_THRESHOLD = 85

const finishedRuns = evalRuns.filter(
  (r) => r.status === "Passed" || r.status === "Failed"
)

/**
 * The eval run a release gate points at. Prefers a finished run of the same
 * agent on the prompt version the release ships, started before the release;
 * falls back to any finished run of the agent with the wanted result. Returns
 * undefined when the agent has no such run, in which case the release carries
 * no gate at all rather than a fake one.
 */
function gateRunFor(
  agentId: string,
  promptVersion: string,
  wanted: "Passed" | "Failed",
  beforeMs: number
): EvalRun | undefined {
  const mine = finishedRuns.filter(
    (r) =>
      r.agentId === agentId &&
      r.status === wanted &&
      (wanted === "Failed" || r.composite >= GATE_THRESHOLD)
  )
  const order = (rows: EvalRun[]) =>
    [...rows].sort((a, b) => b.started.localeCompare(a.started))
  const onPrompt = mine.filter((r) => r.promptVersion === promptVersion)
  return (
    order(
      onPrompt.filter((r) => new Date(r.started).getTime() <= beforeMs)
    )[0] ??
    order(onPrompt)[0] ??
    order(mine.filter((r) => new Date(r.started).getTime() <= beforeMs))[0] ??
    order(mine)[0]
  )
}

/**
 * The release gate an eval run produces: passed when the run passed, otherwise
 * failed with the first reason that explains it (composite under the
 * threshold, regressions on the dataset, or a low pass rate). Used for seeded
 * releases here and for releases drafted in the client session.
 */
export function gateFromRun(run: EvalRun): EvalGate {
  const failed = run.status !== "Passed"
  const reason = !failed
    ? undefined
    : run.composite < GATE_THRESHOLD
      ? `composite ${run.composite} below ${GATE_THRESHOLD}`
      : run.regressions > 0
        ? `${run.regressions} regression${run.regressions === 1 ? "" : "s"} on ${run.datasetId}`
        : `pass rate ${run.passRate}% below 80%`
  return {
    status: failed ? "failed" : "passed",
    score: run.composite,
    threshold: GATE_THRESHOLD,
    runId: run.id,
    reason,
  }
}

function gateFrom(run: EvalRun | undefined): EvalGate | undefined {
  return run ? gateFromRun(run) : undefined
}

/** Prompt version record a release change row points at, if it resolves. */
export function releasePromptVersion(release: Release) {
  const change = release.changes.find((c) => c.kind === "prompt")
  return change ? getPromptVersion(change.after) : undefined
}

/** Ids of the agent's system prompt versions, oldest first. */
function promptChainFor(agentId: string, live: string): string[] {
  const prompt = getPromptForAgent(agentId)
  const chain = prompt
    ? [...prompt.versions].sort((a, b) => a.number - b.number).map((v) => v.id)
    : []
  return chain.includes(live) ? chain : [...chain, live]
}

let seq = 1000
const releases_: Release[] = []
const environments_: EnvironmentState[] = []

for (const agent of deployedAgents) {
  const liveEnv: ReleaseEnvironment =
    agent.environment === "production" ? "production" : "staging"
  const current: ConfigState = {
    prompt: agent.promptVersion,
    promptChain: promptChainFor(agent.id, agent.promptVersion),
    modelId: agent.modelId,
    temperature: agent.params.temperature,
    maxOutputTokens: agent.params.maxOutputTokens,
    reasoningEffort: agent.params.reasoningEffort,
    maxToolCalls: agent.params.maxToolCalls,
    tools: [...agent.tools],
    retrieval: {
      top_k: "8",
      chunk_size: "512",
      reranker: "off",
      hybrid_search: "off",
    },
  }
  const baseQ = agent.metrics.quality
  const baseErr = agent.metrics.errorRate || 0.8

  /* ---- history: walk backwards from the live version ------------------- */
  const historyCount = int(rng, 3, 5)
  let version = parseVersion(agent.version)
  let state = current
  let deployedMs = new Date(agent.lastDeployed).getTime()
  const history: Release[] = []

  for (let h = 0; h < historyCount; h++) {
    const isLatest = h === 0
    const prev = prevVersion(version, rng)
    const { next, changes } = mutate(state, -1, pickKinds())
    const strategy: ReleaseStrategy = isLatest
      ? pick(rng, ["Canary", "Canary", "Blue-green"])
      : pick(rng, ["Canary", "Canary", "Blue-green", "Direct"])
    const stage: ReleaseStage = isLatest
      ? "Promoted"
      : chance(rng, 0.15)
        ? "Rolled back"
        : chance(rng, 0.06)
          ? "Failed"
          : "Promoted"
    const risk = riskFor(changes)
    const durationH =
      strategy === "Canary" ? int(rng, 6, 20) : strategy === "Direct" ? 1 : 2
    const createdMs = deployedMs - int(rng, 8, 60) * HOUR
    const completedMs =
      deployedMs + (stage === "Promoted" ? durationH : int(rng, 1, 4)) * HOUR
    const good = stage === "Promoted"
    const qDelta = good
      ? Math.round((rng() * 2.2 - 0.3) * 10) / 10
      : -Math.round((1.5 + rng() * 4) * 10) / 10
    const errDelta = good
      ? Math.round((rng() * 0.4 - 0.25) * 100) / 100
      : Math.round((0.8 + rng() * 2.5) * 100) / 100
    const steps = stepsFor[strategy]
    const approvers = approversFor(risk, agent.ownerId).map<Approver>(
      (a, i) => ({
        ...a,
        status: "approved",
        at: iso(createdMs + (2 + i * 3) * HOUR),
      })
    )
    // Keep the legacy draw so the rest of the stream is unchanged.
    rng()
    const id = `rel-${++seq}`
    // Gates on promoted history releases always passed; the run is the
    // agent's finished eval on the prompt version this release shipped.
    const gate = gateFrom(
      gateRunFor(agent.id, state.prompt, "Passed", deployedMs)
    )
    const activity: ReleaseEvent[] = [
      {
        id: `${id}-e1`,
        kind: "created",
        at: iso(createdMs),
        actorId: agent.ownerId,
        message: `Draft created from ${formatVersion(prev)}`,
      },
      ...(gate
        ? [
            {
              id: `${id}-e2`,
              kind: "eval" as const,
              at: iso(createdMs + HOUR),
              message: `Eval gate passed on ${agent.evalDataset} (${gate.score.toFixed(1)} ≥ ${gate.threshold})`,
            },
          ]
        : []),
      ...decidedApprovers(approvers).map<ReleaseEvent>((a, i) => ({
        id: `${id}-a${i}`,
        kind: "approval",
        at: a.at,
        actorId: a.userId,
        message: `Approved as ${a.role.toLowerCase()}`,
      })),
      {
        id: `${id}-e3`,
        kind: "deploy",
        at: iso(deployedMs),
        actorId: agent.ownerId,
        message:
          strategy === "Canary"
            ? `Canary started at ${steps[0]}% of ${liveEnv} traffic`
            : strategy === "Blue-green"
              ? "Green stack deployed, awaiting switch"
              : `Deployed directly to ${liveEnv}`,
      },
    ]
    if (strategy === "Canary" && (good || chance(rng, 0.5)))
      activity.push({
        id: `${id}-e4`,
        kind: "advance",
        at: iso(deployedMs + (durationH / 3) * HOUR),
        message: `Advanced to ${steps[1]}%: quality ${qDelta >= 0 ? "+" : ""}${qDelta.toFixed(1)} vs baseline`,
      })
    activity.push(
      stage === "Promoted"
        ? {
            id: `${id}-e5`,
            kind: "promote",
            at: iso(completedMs),
            actorId: agent.ownerId,
            message: `Promoted to 100% of ${liveEnv}`,
          }
        : stage === "Rolled back"
          ? {
              id: `${id}-e5`,
              kind: "rollback",
              at: iso(completedMs),
              actorId: "u-004",
              message: `Rolled back to ${formatVersion(prev)}: error rate +${errDelta.toFixed(2)}pt`,
            }
          : {
              id: `${id}-e5`,
              kind: "fail",
              at: iso(completedMs),
              message:
                "Health check failed: p95 latency above budget for 15 minutes",
            }
    )

    history.push({
      id,
      agentId: agent.id,
      version: formatVersion(version),
      previousVersion: formatVersion(prev),
      environment: liveEnv,
      strategy,
      steps,
      stage,
      summary: summarize(changes),
      changes,
      evalGate: gate,
      traffic: stage === "Promoted" ? 100 : 0,
      health: { errorRateDelta: errDelta, qualityDelta: qDelta },
      risk,
      guardrailCoverage: int(rng, 78, 100),
      costDeltaPct: Math.round((rng() * 30 - 15) * 10) / 10,
      deployedById: pick(rng, [agent.ownerId, agent.ownerId, "u-004", "u-014"]),
      approvers,
      experimentId:
        agent.id === "agt-ops-analyst" && isLatest
          ? "exp-ops-retrieval"
          : undefined,
      createdAt: iso(createdMs),
      deployedAt: iso(deployedMs),
      completedAt: iso(completedMs),
      rollbackTarget: formatVersion(prev),
      rollout: buildRollout(
        deployedMs,
        completedMs,
        steps,
        baseQ,
        baseErr,
        qDelta,
        errDelta,
        stage === "Promoted" ? steps.length - 1 : Math.min(1, steps.length - 1)
      ),
      activity,
    })

    version = prev
    state = next
    deployedMs = createdMs - int(rng, 4, 12) * DAY
  }
  releases_.push(...history)

  /* ---- environments ----------------------------------------------------- */
  const liveVersion = parseVersion(agent.version)
  const latest = history[0]
  if (agent.environment === "production")
    environments_.push({
      agentId: agent.id,
      environment: "production",
      version: agent.version,
      modelId: agent.modelId,
      promptVersion: agent.promptVersion,
      lastDeployedAt: agent.lastDeployed,
      releaseId: latest.id,
    })

  /* ---- in-flight releases: walk forwards ------------------------------- */
  const inflight: { stage: ReleaseStage; env: ReleaseEnvironment }[] = []
  switch (agent.id) {
    case "agt-support-triage":
      inflight.push({ stage: "Canary", env: "production" })
      break
    case "agt-it-helpdesk":
      inflight.push({ stage: "Draft", env: "production" })
      break
    case "agt-ops-analyst":
      inflight.push({ stage: "Progressing", env: "production" })
      break
    case "agt-change-risk":
      inflight.push({ stage: "Pending approval", env: "production" })
      break
    case "agt-hr-answers":
      inflight.push({ stage: "Pending approval", env: "production" })
      break
    case "agt-alert-correlator":
      inflight.push({ stage: "Promoted", env: "shadow" })
      break
    case "agt-kb-curator":
      inflight.push({ stage: "Pending approval", env: "production" })
      break
    case "agt-finance-copilot":
      inflight.push({ stage: "Draft", env: "staging" })
      break
  }

  let fwdVersion = liveVersion
  let fwdState = current
  let stagingVersion = formatVersion(liveVersion)
  let stagingState = current
  let stagingAt = agent.lastDeployed

  for (const spec of inflight) {
    const next = nextVersion(fwdVersion, chance(rng, 0.5))
    const experimentId =
      agent.id === "agt-support-triage"
        ? "exp-triage-prompt-42"
        : agent.id === "agt-it-helpdesk"
          ? "exp-helpdesk-haiku"
          : undefined
    const exp = experimentId
      ? experiments.find((e) => e.id === experimentId)
      : undefined
    let changes: ReleaseChange[]
    let after: ConfigState
    if (exp?.kind === "prompt" && exp.variants[1].promptVersion) {
      const p = exp.variants[1].promptVersion
      changes = [
        {
          kind: "prompt",
          field: "Prompt",
          before: fwdState.prompt,
          after: p,
        },
      ]
      after = { ...fwdState, prompt: p }
    } else if (exp?.kind === "model" && exp.variants[1].modelId) {
      changes = [
        {
          kind: "model",
          field: "Model",
          before: fwdState.modelId,
          after: exp.variants[1].modelId,
        },
        {
          kind: "params",
          field: "temperature",
          before: String(fwdState.temperature),
          after: "0.2",
        },
      ]
      after = {
        ...fwdState,
        modelId: exp.variants[1].modelId,
        temperature: 0.2,
      }
    } else {
      const m = mutate(fwdState, 1, pickKinds())
      changes = m.changes
      after = m.next
    }
    const strategy: ReleaseStrategy =
      spec.env === "shadow"
        ? "Shadow"
        : spec.env === "staging"
          ? "Direct"
          : pick(rng, ["Canary", "Canary", "Blue-green"])
    const steps = stepsFor[strategy]
    const risk = riskFor(changes)
    const nowMs = NOW.getTime()
    const latestMs = new Date(agent.lastDeployed).getTime()
    const createdMs =
      Math.round(
        (latestMs + (nowMs - latestMs) * (0.3 + rng() * 0.4)) / QUARTER
      ) * QUARTER
    const id = `rel-${++seq}`
    const approvers = approversFor(risk, agent.ownerId).map<Approver>(
      (a, i) => {
        if (spec.stage === "Draft") return a
        if (spec.stage === "Pending approval")
          return i === 0
            ? { ...a, status: "approved", at: iso(createdMs + 3 * HOUR) }
            : a
        return {
          ...a,
          status: "approved",
          at: iso(createdMs + (2 + i * 2) * HOUR),
        }
      }
    )
    const qDelta = Math.round((rng() * 2 - 0.4) * 10) / 10
    const errDelta = Math.round((rng() * 0.5 - 0.3) * 100) / 100
    // Keep the legacy draw so the rest of the stream is unchanged.
    rng()
    // Drafts have not been evaluated yet; Knowledge Curator's pending release
    // is the sample of a failed gate, everything else passed on a real run.
    const gate: EvalGate | undefined =
      spec.stage === "Draft"
        ? undefined
        : gateFrom(
            gateRunFor(
              agent.id,
              after.prompt,
              agent.id === "agt-kb-curator" ? "Failed" : "Passed",
              nowMs
            )
          )
    const deployed =
      spec.stage === "Canary" ||
      spec.stage === "Progressing" ||
      spec.stage === "Promoted"
    const deployedMs = createdMs + int(rng, 6, 14) * HOUR
    const stepIdx =
      spec.stage === "Canary"
        ? 0
        : spec.stage === "Progressing"
          ? 1
          : spec.stage === "Promoted"
            ? steps.length - 1
            : 0
    const traffic = deployed ? steps[Math.min(stepIdx, steps.length - 1)] : 0
    const completedMs =
      spec.stage === "Promoted" ? deployedMs + 2 * HOUR : undefined

    const activity: ReleaseEvent[] = [
      {
        id: `${id}-e1`,
        kind: "created",
        at: iso(createdMs),
        actorId: agent.ownerId,
        message: exp
          ? `Draft created from experiment ${exp.id} (variant B)`
          : `Draft created from ${agent.version}`,
      },
    ]
    if (gate && gate.status !== "pending")
      activity.push({
        id: `${id}-e2`,
        kind: "eval",
        at: iso(createdMs + 1.5 * HOUR),
        message:
          gate.status === "passed"
            ? `Eval gate passed on ${agent.evalDataset} (${gate.score.toFixed(1)} ≥ ${gate.threshold})`
            : `Eval gate failed on ${agent.evalDataset}: ${gate.reason ?? `${gate.score.toFixed(1)} < ${gate.threshold}`}`,
      })
    decidedApprovers(approvers)
      .filter((a) => a.status === "approved")
      .forEach((a, i) =>
        activity.push({
          id: `${id}-a${i}`,
          kind: "approval",
          at: a.at,
          actorId: a.userId,
          message: `Approved as ${a.role.toLowerCase()}`,
        })
      )
    if (spec.stage === "Pending approval")
      activity.push({
        id: `${id}-e3`,
        kind: "note",
        at: iso(createdMs + 4 * HOUR),
        actorId: agent.ownerId,
        message: `Approval requested from ${approvers.filter((a) => a.status === "pending").length} reviewer(s)`,
      })
    if (deployed)
      activity.push({
        id: `${id}-e4`,
        kind: "deploy",
        at: iso(deployedMs),
        actorId: agent.ownerId,
        message:
          strategy === "Shadow"
            ? "Shadow deployment receiving mirrored traffic"
            : strategy === "Direct"
              ? `Deployed to ${spec.env}`
              : `Canary started at ${steps[0]}% of production traffic`,
      })
    if (spec.stage === "Progressing")
      activity.push({
        id: `${id}-e5`,
        kind: "advance",
        at: iso(deployedMs + 5 * HOUR),
        actorId: "u-004",
        message: `Advanced to ${steps[1]}%: error rate ${errDelta >= 0 ? "+" : ""}${errDelta.toFixed(2)}pt vs baseline`,
      })
    if (spec.stage === "Promoted" && completedMs)
      activity.push({
        id: `${id}-e6`,
        kind: "promote",
        at: iso(completedMs),
        actorId: agent.ownerId,
        message:
          spec.env === "shadow"
            ? "Shadow run complete: parity report attached"
            : `Promoted to ${spec.env}`,
      })

    const release: Release = {
      id,
      agentId: agent.id,
      version: formatVersion(next),
      previousVersion: formatVersion(fwdVersion),
      environment: spec.env,
      strategy,
      steps,
      stage: spec.stage,
      summary: summarize(changes),
      changes,
      evalGate: gate,
      traffic,
      health: deployed
        ? { errorRateDelta: errDelta, qualityDelta: qDelta }
        : { errorRateDelta: 0, qualityDelta: 0 },
      risk,
      guardrailCoverage: agent.id === "agt-hr-answers" ? 72 : int(rng, 84, 100),
      costDeltaPct:
        exp?.kind === "model" ? -38.4 : Math.round((rng() * 20 - 8) * 10) / 10,
      deployedById: agent.ownerId,
      approvers,
      experimentId,
      createdAt: iso(createdMs),
      deployedAt: deployed ? iso(deployedMs) : undefined,
      completedAt: completedMs ? iso(completedMs) : undefined,
      rollbackTarget: agent.version,
      rollout: deployed
        ? buildRollout(
            deployedMs,
            completedMs ?? nowMs,
            steps,
            baseQ,
            baseErr,
            qDelta,
            errDelta,
            stepIdx
          )
        : [],
      activity,
    }
    releases_.push(release)

    if (spec.env === "shadow")
      environments_.push({
        agentId: agent.id,
        environment: "shadow",
        version: release.version,
        modelId: after.modelId,
        promptVersion: after.prompt,
        lastDeployedAt: release.deployedAt ?? release.createdAt,
        releaseId: release.id,
      })
    // Anything beyond production already lives in staging (drafts do not).
    if (spec.env !== "shadow" && spec.stage !== "Draft") {
      stagingVersion = release.version
      stagingState = after
      stagingAt = iso(createdMs - 2 * HOUR)
    }
    fwdVersion = next
    fwdState = after
  }

  environments_.push({
    agentId: agent.id,
    environment: "staging",
    version: stagingVersion,
    modelId: stagingState.modelId,
    promptVersion: stagingState.prompt,
    lastDeployedAt: stagingAt,
    releaseId: releases_.find(
      (r) => r.agentId === agent.id && r.version === stagingVersion
    )?.id,
  })
  const dev = nextVersion(parseVersion(stagingVersion), chance(rng, 0.4))
  // Development runs the next version in the agent's own chain when one
  // exists (a draft or staging prompt), otherwise the same prompt as staging.
  const devPrompt =
    stagingState.promptChain[
      stagingState.promptChain.indexOf(stagingState.prompt) + 1
    ] ?? stagingState.prompt
  environments_.push({
    agentId: agent.id,
    environment: "development",
    version: formatVersion(dev),
    modelId: stagingState.modelId,
    promptVersion: devPrompt,
    lastDeployedAt: iso(NOW.getTime() - int(rng, 2, 30) * HOUR),
  })
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                     */
/* -------------------------------------------------------------------------- */

export const releases: Release[] = releases_.sort((a, b) =>
  b.createdAt.localeCompare(a.createdAt)
)

export const environments: EnvironmentState[] = environments_

export function getRelease(id: string) {
  return releases.find((r) => r.id === id)
}

export function getEnvironment(
  agentId: string,
  environment: ReleaseEnvironment
) {
  return environments.find(
    (e) => e.agentId === agentId && e.environment === environment
  )
}

export const releaseApprovals: ReleaseApproval[] = releases
  .filter((r) => r.stage === "Pending approval")
  .map((r) => {
    const exp = r.experimentId
      ? experiments.find((e) => e.id === r.experimentId)
      : undefined
    const requested =
      r.activity.find((a) => a.kind === "note")?.at ?? r.createdAt
    return {
      id: `apr-${r.id.slice(4)}`,
      releaseId: r.id,
      risk: r.risk,
      requestedAt: requested,
      due: iso(new Date(requested).getTime() + 2 * DAY),
      evidence: {
        evalGate: r.evalGate,
        experimentSignificance: exp?.significance,
        guardrailCoverage: r.guardrailCoverage,
        costDeltaPct: r.costDeltaPct,
      },
      approvers: r.approvers,
    }
  })

/** Releases waiting on a human decision (Approvals inbox, badges). */
export function pendingReleaseApprovalCount(list: Release[] = releases) {
  return list.filter((r) => r.stage === "Pending approval").length
}

/** Releases currently in flight: canary, progressing or awaiting approval. */
export function activeReleaseCount(list: Release[] = releases) {
  return list.filter((r) =>
    ["Canary", "Progressing", "Pending approval"].includes(r.stage)
  ).length
}

export const releaseStages: ReleaseStage[] = [
  "Draft",
  "Pending approval",
  "Canary",
  "Progressing",
  "Promoted",
  "Rolled back",
  "Failed",
]

export const releaseStrategies: ReleaseStrategy[] = [
  "Canary",
  "Blue-green",
  "Shadow",
  "Direct",
]

export const releaseEnvironments: ReleaseEnvironment[] = [
  "production",
  "staging",
  "development",
  "shadow",
]

/** Hours between creation and promotion for promoted releases. */
export function timeToPromoteHours(r: Release) {
  if (r.stage !== "Promoted" || !r.completedAt) return null
  return (
    (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / HOUR
  )
}
