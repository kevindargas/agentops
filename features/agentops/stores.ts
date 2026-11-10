/**
 * Module-scoped client stores for the Agent Operations slice. Every table,
 * stat card, badge and action that touches reviews, experiments,
 * recommendations, drift signals, semantic definitions or the agent list reads
 * the same store, so a decision on one surface moves the numbers on every
 * other surface in the same session. Nothing is persisted: a reload returns
 * to the seed.
 */

import {
  defaultExperimentSplit,
  deployedAgents,
  driftSignals,
  experiments,
  getDeployedAgent,
  modelRecommendations,
  reviewItems,
  semanticEntities,
} from "@/lib/data/agentops"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { createListStore } from "@/lib/store"
import type {
  AgentTrace,
  DeployedAgent,
  DriftSignal,
  Experiment,
  ExperimentKind,
  ExperimentMetric,
  ModelRecommendation,
  ReviewItem,
  SemanticEntity,
} from "@/lib/types"

export const agentStore = createListStore<DeployedAgent>(
  deployedAgents,
  (a) => a.id
)
export const reviewStore = createListStore<ReviewItem>(reviewItems, (r) => r.id)
export const driftStore = createListStore<DriftSignal>(
  driftSignals,
  (s) => s.id
)
export const experimentStore = createListStore<Experiment>(
  experiments,
  (e) => e.id
)
export const recommendationStore = createListStore<ModelRecommendation>(
  modelRecommendations,
  (r) => r.id
)
export const semanticStore = createListStore<SemanticEntity>(
  semanticEntities,
  (s) => s.id
)

/* -------------------------------------------------------------------------- */
/* Factories for records created from the UI                                   */
/* -------------------------------------------------------------------------- */

function nextId(prefix: string, existing: { id: string }[]) {
  const n = existing.filter((x) => x.id.startsWith(prefix)).length + 1
  return `${prefix}${String(n).padStart(3, "0")}`
}

/**
 * Queue a trace for human review. Returns the existing item when the trace is
 * already in the queue so callers never create duplicates.
 */
export function queueTraceForReview(trace: AgentTrace): {
  item: ReviewItem
  created: boolean
} {
  const existing = reviewStore.get().find((r) => r.traceId === trace.id)
  if (existing) return { item: existing, created: false }
  const item: ReviewItem = {
    id: nextId("rev-s", reviewStore.get()),
    traceId: trace.id,
    agentId: trace.agentId,
    reason:
      trace.userFeedback === "down" ? "User thumbs-down" : "Random sample",
    priority: trace.userFeedback === "down" ? 2 : 3,
    status: "Pending",
    created: clock().toISOString(),
    assignedToId: currentUser.id,
  }
  reviewStore.add(item, "start")
  return { item, created: true }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32)

export interface DraftExperimentInput {
  agentId: string
  kind: ExperimentKind
  name: string
  hypothesis: string
  primaryMetric: ExperimentMetric
  /** Model for variant B (model experiments). */
  toModelId?: string
}

/**
 * Create a Draft experiment in the shared store: control is the agent's
 * current configuration, variant B has no traffic yet. Used by "Start A/B
 * test" on a recommendation and "Start experiment" on a drift signal.
 */
export function draftExperiment(input: DraftExperimentInput): Experiment {
  const agent = getDeployedAgent(input.agentId)
  const existing = experimentStore.get()
  let id = `exp-${slug(input.name)}`
  if (existing.some((e) => e.id === id)) id = `${id}-${existing.length + 1}`
  const empty = {
    requests: 0,
    quality: 0,
    p95Ms: 0,
    costPer1k: 0,
    thumbsUp: 0,
    errorRate: 0,
  }
  const experiment: Experiment = {
    id,
    name: input.name,
    agentId: input.agentId,
    hypothesis: input.hypothesis,
    kind: input.kind,
    status: "Draft",
    split: defaultExperimentSplit,
    primaryMetric: input.primaryMetric,
    started: clock().toISOString(),
    ownerId: currentUser.id,
    variants: [
      {
        key: "A",
        label: "Control · current configuration",
        modelId: agent?.modelId,
        promptVersion: agent?.promptVersion,
        ...empty,
        quality: agent?.metrics.quality ?? 0,
        p95Ms: agent?.metrics.p95Ms ?? 0,
      },
      {
        key: "B",
        label: input.toModelId
          ? `Variant · ${input.toModelId.split("/").pop()}`
          : "Variant · proposed change",
        modelId: input.toModelId,
        ...empty,
      },
    ],
    significance: 0,
    daily: [],
  }
  experimentStore.add(experiment, "start")
  return experiment
}
