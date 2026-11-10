import { describe, expect, it } from "vitest"

import { cabSchedule } from "@/lib/constants"
import * as activity from "./activity"
import * as agentConfig from "./agent-config"
import * as agentops from "./agentops"
import * as audit from "./audit"
import * as catalog from "./catalog"
import * as cmdb from "./cmdb"
import * as costs from "./costs"
import * as deployments from "./deployments"
import * as evals from "./evals"
import * as guardrails from "./guardrails"
import * as itom from "./itom"
import * as itsm from "./itsm"
import * as knowledge from "./knowledge"
import * as prompts from "./prompts"
import * as providers from "./providers"
import * as readiness from "./readiness"
import * as schedules from "./schedules"
import { NOW } from "./seed"
import * as tools from "./tools"
import * as users from "./users"

/* -------------------------------------------------------------------------- */
/* Id registries                                                               */
/* -------------------------------------------------------------------------- */

const ids = {
  user: new Set(users.users.map((u) => u.id)),
  group: new Set(users.groups.map((g) => g.id)),
  agent: new Set(agentops.deployedAgents.map((a) => a.id)),
  trace: new Set(agentops.agentTraces.map((t) => t.id)),
  experiment: new Set(agentops.experiments.map((e) => e.id)),
  recommendation: new Set(agentops.modelRecommendations.map((r) => r.id)),
  semantic: new Set(agentops.semanticEntities.map((s) => s.id)),
  drift: new Set(agentops.driftSignals.map((d) => d.id)),
  review: new Set(agentops.reviewItems.map((r) => r.id)),
  prompt: new Set(prompts.prompts.map((p) => p.id)),
  promptVersion: new Set(prompts.promptVersions.map((v) => v.id)),
  run: new Set(evals.evalRuns.map((r) => r.id)),
  dataset: new Set(evals.evalDatasets.map((d) => d.id)),
  evaluator: new Set(evals.evaluators.map((e) => e.id)),
  release: new Set(deployments.releases.map((r) => r.id)),
  releaseApproval: new Set(deployments.releaseApprovals.map((a) => a.id)),
  policy: new Set(guardrails.guardrails.map((g) => g.id)),
  violation: new Set(guardrails.guardrailViolations.map((v) => v.id)),
  tool: new Set(tools.tools.map((t) => t.name)),
  server: new Set(tools.mcpServers.map((s) => s.id)),
  kb: new Set(knowledge.knowledgeBases.map((k) => k.id)),
  kbSource: new Set(knowledge.kbSources.map((s) => s.id)),
  memory: new Set(knowledge.memoryStores.map((m) => m.id)),
  provider: new Set(providers.providers.map((p) => p.id)),
  key: new Set(providers.apiKeys.map((k) => k.id)),
  routing: new Set(providers.routingRules.map((r) => r.id)),
  budget: new Set(costs.budgets.map((b) => b.id)),
  schedule: new Set(schedules.schedules.map((s) => s.id)),
  trigger: new Set(schedules.triggers.map((t) => t.id)),
  scheduledRun: new Set(schedules.scheduledRuns.map((r) => r.id)),
  ci: new Set(cmdb.configurationItems.map((c) => c.id)),
  incident: new Set(itsm.incidents.map((i) => i.number)),
  problem: new Set(itsm.problems.map((p) => p.number)),
  change: new Set(itsm.changes.map((c) => c.number)),
  request: new Set(itsm.requests.map((r) => r.number)),
  article: new Set(catalog.knowledgeArticles.map((a) => a.number)),
  catalogItem: new Set(catalog.catalogItems.map((c) => c.id)),
}

type Registry = keyof typeof ids

/** Which registry a value under a given key must resolve in. */
const keyRegistry: Record<string, Registry> = {
  ownerId: "user",
  authorId: "user",
  assignedToId: "user",
  reviewerId: "user",
  approverId: "user",
  actorId: "user",
  deployedById: "user",
  byId: "user",
  acknowledgedById: "user",
  callerId: "user",
  requestedById: "user",
  requestedForId: "user",
  userId: "user",
  changedBy: "user",
  manager: "user",
  agentId: "agent",
  agentIds: "agent",
  usedByAgentIds: "agent",
  traceId: "trace",
  experimentId: "experiment",
  recommendationId: "recommendation",
  semanticEntityIds: "semantic",
  promptId: "prompt",
  promptVersion: "promptVersion",
  runId: "run",
  lastRunId: "run",
  baselineRunId: "run",
  lastRedTeamRunId: "run",
  datasetId: "dataset",
  evalDataset: "dataset",
  usedInDatasetIds: "dataset",
  evaluatorIds: "evaluator",
  releaseId: "release",
  policyId: "policy",
  guardrailIds: "policy",
  serverId: "server",
  kbId: "kb",
  knowledgeBaseIds: "kb",
  providerId: "provider",
  budgetId: "budget",
  ciId: "ci",
  problemId: "problem",
  changeId: "change",
  incidentNumber: "incident",
  catalogItemId: "catalogItem",
  assignmentGroupId: "group",
  supportGroupId: "group",
  fulfillmentGroupId: "group",
  replacedBy: "tool",
  compensatingToolId: "tool",
  toolNames: "tool",
}

/** Keys whose values are tool names on agent records. */
const toolListKeys = new Set(["tools"])

interface Violation {
  path: string
  value: string
  registry: string
}

function walk(
  value: unknown,
  path: string,
  out: Violation[],
  seen = new WeakSet<object>()
) {
  if (value === null || typeof value !== "object") return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, out, seen))
    return
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    // Trigger deliveries point at scheduled runs (`run-...`), not eval runs.
    const registry: Registry | undefined =
      key === "runId" && typeof v === "string" && v.startsWith("run-")
        ? "scheduledRun"
        : keyRegistry[key]
    const here = `${path}.${key}`
    if (registry && typeof v === "string") {
      if (!ids[registry].has(v)) out.push({ path: here, value: v, registry })
    } else if (registry && Array.isArray(v)) {
      for (const item of v)
        if (typeof item === "string" && !ids[registry].has(item))
          out.push({ path: here, value: item, registry })
    } else if (toolListKeys.has(key) && Array.isArray(v)) {
      for (const item of v)
        if (typeof item === "string" && !ids.tool.has(item))
          out.push({ path: here, value: item, registry: "tool" })
    } else if (key === "scope" && Array.isArray(v)) {
      for (const item of v)
        if (typeof item === "string" && !ids.agent.has(item))
          out.push({ path: here, value: item, registry: "agent" })
    } else {
      walk(v, here, out, seen)
    }
  }
}

/** Every exported array of records, by module. */
const collections: Record<string, unknown> = {
  users: users.users,
  groups: users.groups,
  deployedAgents: agentops.deployedAgents,
  agentTraces: agentops.agentTraces,
  reviewItems: agentops.reviewItems,
  driftSignals: agentops.driftSignals,
  experiments: agentops.experiments,
  modelRecommendations: agentops.modelRecommendations,
  semanticEntities: agentops.semanticEntities,
  fleetControls: agentops.fleetControls,
  prompts: prompts.prompts,
  evaluators: evals.evaluators,
  evalDatasets: evals.evalDatasets,
  evalRuns: evals.evalRuns,
  releaseGates: evals.releaseGates,
  releases: deployments.releases,
  environments: deployments.environments,
  releaseApprovals: deployments.releaseApprovals,
  guardrails: guardrails.guardrails,
  guardrailViolations: guardrails.guardrailViolations,
  tools: tools.tools,
  mcpServers: tools.mcpServers,
  toolPermissions: tools.toolPermissions,
  knowledgeBases: knowledge.knowledgeBases,
  kbSources: knowledge.kbSources,
  ingestionJobs: knowledge.ingestionJobs,
  memoryStores: knowledge.memoryStores,
  lowRecallQueries: knowledge.lowRecallQueries,
  providers: providers.providers,
  providerIncidents: providers.providerIncidents,
  apiKeys: providers.apiKeys,
  routingRules: providers.routingRules,
  rateLimits: providers.rateLimits,
  budgets: costs.budgets,
  savingsOpportunities: costs.savingsOpportunities,
  costByAgent: costs.costByAgent,
  schedules: schedules.schedules,
  triggers: schedules.triggers,
  scheduledRuns: schedules.scheduledRuns,
  auditEvents: audit.auditEvents,
  incidents: itsm.incidents,
  problems: itsm.problems,
  changes: itsm.changes,
  requests: itsm.requests,
  alerts: itom.alerts,
  serviceHealth: itom.serviceHealth,
  configurationItems: cmdb.configurationItems,
  ciRelationships: cmdb.ciRelationships,
  catalogItems: catalog.catalogItems,
  knowledgeArticles: catalog.knowledgeArticles,
  notifications: activity.notifications,
  approvals: activity.approvals,
}

/* -------------------------------------------------------------------------- */
/* Generic cross-reference walk                                                */
/* -------------------------------------------------------------------------- */

describe("cross-reference integrity", () => {
  it("resolves every id-like field in every data module", () => {
    const out: Violation[] = []
    for (const [name, value] of Object.entries(collections))
      walk(value, name, out)
    expect(out, JSON.stringify(out.slice(0, 20), null, 1)).toEqual([])
  })

  it("keeps every id unique within its registry", () => {
    for (const [name, value] of Object.entries(collections)) {
      if (!Array.isArray(value) || !value.length) continue
      const first = value[0] as Record<string, unknown>
      const key = "id" in first ? "id" : "number" in first ? "number" : null
      if (!key) continue
      const all = value.map((v) => (v as Record<string, unknown>)[key])
      expect(new Set(all).size, name).toBe(all.length)
    }
  })

  it("resolves the ids quoted in audit targets and notification links", () => {
    const targetRegistry: Record<string, Registry | undefined> = {
      "prompt-version": "promptVersion",
      guardrail: "policy",
      release: "release",
      trace: "trace",
      tool: "tool",
      "mcp-server": "server",
      budget: "budget",
      "memory-store": "memory",
      "api-key": "key",
      agent: "agent",
    }
    for (const e of audit.auditEvents) {
      const registry = targetRegistry[e.target.kind]
      if (registry) expect(ids[registry].has(e.target.id), e.id).toBe(true)
      if (e.context.releaseId)
        expect(ids.release.has(e.context.releaseId), e.id).toBe(true)
      if (e.context.approvalId)
        expect(ids.releaseApproval.has(e.context.approvalId), e.id).toBe(true)
    }
    const idInHref =
      /\/(?:deployments|traces|agents|evals|prompts|incidents|changes|requests|problems)\/([^/?#]+)/
    for (const n of activity.notifications) {
      const m = n.href.match(idInHref)
      if (!m) continue
      const id = m[1]
      const known = Object.values(ids).some((set) => set.has(id))
      expect(known, `${n.id} -> ${n.href}`).toBe(true)
    }
    for (const n of activity.notifications)
      for (const id of n.body.match(/\b(rel-\d+|bud-\d+|key-\d+)\b/g) ?? [])
        expect(
          Object.values(ids).some((set) => set.has(id)),
          `${n.id} mentions ${id}`
        ).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Relationship symmetry                                                       */
/* -------------------------------------------------------------------------- */

describe("relationship symmetry", () => {
  it("counts problem incidents from the incidents that carry the problem id", () => {
    for (const p of itsm.problems)
      expect(p.relatedIncidents, p.number).toBe(
        itsm.incidents.filter((i) => i.problemId === p.number).length
      )
    expect(itsm.incidentsForProblem("PRB0040011").length).toBeGreaterThan(0)
  })

  it("agrees on tools in both directions", () => {
    for (const a of agentops.deployedAgents)
      for (const name of a.tools)
        expect(tools.getTool(name)?.agentIds, `${name} <- ${a.id}`).toContain(
          a.id
        )
    for (const t of tools.tools)
      for (const agentId of t.agentIds)
        expect(
          agentops.getDeployedAgent(agentId)?.tools,
          `${t.name} -> ${agentId}`
        ).toContain(t.name)
  })

  it("derives semantic entity usage from the agents' allowlists", () => {
    for (const s of agentops.semanticEntities) {
      const fromAgents = agentops.deployedAgents
        .filter((a) => a.semanticEntityIds.includes(s.id))
        .map((a) => a.id)
      expect([...s.usedByAgentIds].sort(), s.id).toEqual(fromAgents.sort())
    }
  })

  it("attaches prompts to real guardrail policies in scope for the agent", () => {
    for (const p of prompts.prompts) {
      expect(p.guardrails.length).toBe(p.guardrailIds.length)
      p.guardrailIds.forEach((id, i) => {
        const g = guardrails.getGuardrail(id)
        expect(g, `${p.id} -> ${id}`).toBeDefined()
        expect(g?.name).toBe(p.guardrails[i])
        expect(
          guardrails.guardrailAppliesTo(g!, p.agentId),
          `${id} does not cover ${p.agentId}`
        ).toBe(true)
      })
    }
    for (const [id, name] of Object.entries(prompts.promptGuardrailNames))
      expect(guardrails.getGuardrail(id)?.name, id).toBe(name)
  })

  it("keeps eval runs, releases and environments on the agent's own prompt", () => {
    const promptOf = (agentId: string) => prompts.getPromptForAgent(agentId)?.id
    for (const r of evals.evalRuns)
      expect(
        prompts.getPromptVersion(r.promptVersion)?.promptId,
        `${r.id} ${r.promptVersion}`
      ).toBe(promptOf(r.agentId))
    for (const r of deployments.releases)
      for (const c of r.changes.filter((c) => c.kind === "prompt")) {
        expect(prompts.getPromptVersion(c.before)?.promptId, r.id).toBe(
          promptOf(r.agentId)
        )
        expect(prompts.getPromptVersion(c.after)?.promptId, r.id).toBe(
          promptOf(r.agentId)
        )
      }
    for (const e of deployments.environments)
      expect(
        prompts.getPromptVersion(e.promptVersion)?.promptId,
        `${e.agentId} ${e.environment}`
      ).toBe(promptOf(e.agentId))
  })

  it("points release gates at finished eval runs of the same agent", () => {
    for (const r of deployments.releases) {
      if (r.stage === "Draft") {
        expect(r.evalGate, r.id).toBeUndefined()
        continue
      }
      if (!r.evalGate) continue
      const run = evals.getEvalRun(r.evalGate.runId)
      expect(run, `${r.id} -> ${r.evalGate.runId}`).toBeDefined()
      expect(run?.agentId).toBe(r.agentId)
      expect(run?.composite).toBe(r.evalGate.score)
      expect(run?.status).toBe(
        r.evalGate.status === "passed" ? "Passed" : "Failed"
      )
      if (r.evalGate.status === "passed")
        expect(r.evalGate.score).toBeGreaterThanOrEqual(r.evalGate.threshold)
      else expect(r.evalGate.reason).toBeTruthy()
    }
    expect(
      deployments.releases.filter(
        (r) => r.stage === "Promoted" && r.evalGate?.status === "passed"
      ).length
    ).toBeGreaterThan(20)
    const kb = deployments.releases.find(
      (r) => r.agentId === "agt-kb-curator" && r.stage === "Pending approval"
    )
    expect(kb?.evalGate?.status).toBe("failed")
  })

  it("links traces, reviews, violations and scheduled runs to the same agent", () => {
    for (const r of agentops.reviewItems)
      expect(agentops.getTrace(r.traceId)?.agentId, r.id).toBe(r.agentId)
    for (const v of guardrails.guardrailViolations) {
      expect(agentops.getTrace(v.traceId)?.agentId, v.id).toBe(v.agentId)
      expect(agentops.getDeployedAgent(v.agentId)?.paused, v.id).toBe(false)
    }
    for (const r of schedules.scheduledRuns)
      if (r.traceId)
        expect(agentops.getTrace(r.traceId)?.agentId, r.id).toBe(r.agentId)
    for (const q of knowledge.lowRecallQueries)
      expect(agentops.getTrace(q.traceId)?.agentId, q.id).toBe(q.agentId)
    // Every trace marked for review has a queue item.
    const queued = new Set(agentops.reviewItems.map((r) => r.traceId))
    for (const t of agentops.agentTraces)
      if (t.status === "Needs review" || t.status === "Reviewed")
        expect(queued.has(t.id), t.id).toBe(true)
  })

  it("retrieves from knowledge bases that grant the agent access", () => {
    for (const t of agentops.agentTraces) {
      for (const s of t.spans)
        if (s.type === "retriever" && s.attributes?.index) {
          const kb = knowledge.getKnowledgeBase(String(s.attributes.index))
          expect(kb, `${t.id} ${s.attributes.index}`).toBeDefined()
          expect(kb?.access.agentIds, t.id).toContain(t.agentId)
        }
      if (t.lineage.indexBuildId)
        expect(
          knowledge.knowledgeBases.some((k) =>
            (t.lineage.indexBuildId as string).includes(k.id)
          ),
          t.id
        ).toBe(true)
    }
    for (const [agentId, kbId] of Object.entries(
      agentops.primaryKnowledgeBaseByAgent
    ))
      expect(knowledge.getKnowledgeBase(kbId)?.access.agentIds, kbId).toContain(
        agentId
      )
    for (const q of knowledge.lowRecallQueries)
      expect(
        knowledge.getKnowledgeBase(q.kbId)?.access.agentIds,
        q.id
      ).toContain(q.agentId)
  })

  it("names real users as readiness respondents and voters", () => {
    const names = new Set(users.users.map((u) => u.name))
    for (const r of readiness.sampleAssessment.respondents)
      expect(names.has(r), r).toBe(true)
    for (const [id, resp] of Object.entries(
      readiness.sampleAssessment.responses
    )) {
      if (resp.ownerId) expect(ids.user.has(resp.ownerId), id).toBe(true)
      for (const voter of Object.keys(resp.votes ?? {}))
        expect(readiness.sampleAssessment.respondents, id).toContain(voter)
    }
  })

  it("gives the platform owner the expected identity", () => {
    expect(users.currentUser.id).toBe("u-001")
    expect(users.currentUser.name).toBe("Kevin Dargas")
    for (const a of agentops.deployedAgents) {
      const owner = users.getUser(a.ownerId)
      expect(owner, a.id).toBeDefined()
      expect(owner?.name).not.toContain("Gandomcar")
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Numeric coherence                                                           */
/* -------------------------------------------------------------------------- */

describe("numeric coherence", () => {
  it("reports the same spend today everywhere", () => {
    const today = costs.costToday
    for (const a of agentops.deployedAgents)
      expect(today.byAgent[a.id] ?? 0, a.id).toBeCloseTo(
        a.metrics.costPerDay,
        2
      )
    expect(today.cost).toBeCloseTo(agentops.fleetTotals.costPerDay, 1)
    expect(today.requests).toBe(agentops.fleetTotals.requests24h)
    expect(agentops.fleetDaily.at(-1)?.cost).toBeCloseTo(today.cost, 1)
    expect(agentops.fleetDaily.at(-1)?.requests).toBe(today.requests)
    for (const p of providers.providers)
      expect(p.spendToday, p.id).toBeCloseTo(today.byProvider[p.id] ?? 0, 1)
    const byProvider = Object.keys(today.byProvider)
    for (const pid of byProvider) {
      expect(ids.provider.has(pid), pid).toBe(true)
      expect(providers.getProvider(pid)?.status, pid).not.toBe("Disconnected")
    }
    for (const b of costs.budgets)
      if (b.scope.kind === "agent") {
        expect(ids.agent.has(b.scope.id), b.id).toBe(true)
        if (b.period === "daily")
          expect(b.spent, b.id).toBeCloseTo(
            agentops.getDeployedAgent(b.scope.id)!.metrics.costPerDay,
            2
          )
      } else if (b.scope.kind === "team") {
        expect(
          agentops.deployedAgents.some((a) => a.team === b.scope.id),
          b.id
        ).toBe(true)
      }
  })

  it("keeps key spend inside the fleet's 30-day spend", () => {
    const fleet30d = costs.costDaily.reduce((s, d) => s + d.cost, 0)
    const keys = providers.apiKeys.reduce((s, k) => s + k.monthlySpend, 0)
    expect(Math.abs(keys - fleet30d)).toBeLessThan(providers.apiKeys.length)
    const byProvider = costs.spendByProvider()
    for (const p of providers.providers) {
      const mine = providers.apiKeys
        .filter((k) => k.providerId === p.id)
        .reduce((s, k) => s + k.monthlySpend, 0)
      expect(Math.abs(mine - (byProvider[p.id] ?? 0)), p.id).toBeLessThan(4)
    }
    const revoked = providers.apiKeys.filter((k) => k.status === "Revoked")
    for (const k of revoked) {
      expect(k.monthlySpend, k.id).toBe(0)
      if (k.lastUsed && k.expires)
        expect(k.lastUsed <= k.expires, `${k.id} used after expiry`).toBe(true)
    }
  })

  it("quotes one savings figure per recommendation", () => {
    for (const s of costs.savingsOpportunities) {
      if (!s.recommendationId) continue
      const rec = agentops.modelRecommendations.find(
        (r) => r.id === s.recommendationId
      )
      if (rec?.savingsPerMonth)
        expect(s.estimatedMonthlySavings, s.id).toBe(rec.savingsPerMonth)
    }
  })

  it("aligns drift severity with the fleet attention list", () => {
    for (const a of agentops.deployedAgents) {
      const top = agentops.openDriftSeverity(a.id)
      if (a.health === "Drifting") expect(top, a.id).toBe("Critical")
      if (top === "Critical") expect(a.health, a.id).not.toBe("Healthy")
    }
    const rec = agentops.modelRecommendations.find((r) => r.id === "rec-006")
    expect(rec?.fromModelId).not.toBe(rec?.toModelId)
  })

  it("does not route disconnected providers as a primary target", () => {
    for (const rule of providers.routingRules) {
      const primary = providers.getProvider(rule.chain[0].providerId)
      expect(primary?.status, rule.id).not.toBe("Disconnected")
    }
    const paused = agentops.deployedAgents.filter((a) => a.paused)
    for (const s of schedules.schedules)
      if (paused.some((a) => a.id === s.agentId))
        expect(s.enabled, s.id).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Facets and clocks                                                           */
/* -------------------------------------------------------------------------- */

describe("facet values and clock", () => {
  it("produces every value the facets list", () => {
    const flags = new Set(agentops.agentTraces.flatMap((t) => t.flags))
    for (const f of agentops.traceFlags) expect(flags.has(f), f).toBe(true)
    const bounds = new Set(
      agentops.agentTraces.map((t) => t.boundHit).filter(Boolean)
    )
    for (const b of ["max_steps", "deadline", "cost_budget", "no_progress"])
      expect(bounds.has(b as never), b).toBe(true)
    expect(agentops.experiments.some((e) => e.status === "Promoted")).toBe(true)
    expect(itsm.changes.some((c) => c.approval === "Rejected")).toBe(true)
    for (const a of itom.alerts)
      if (a.acknowledged) expect(a.acknowledgedById, a.number).toBeTruthy()
  })

  it("never dates a record after the frozen clock", () => {
    const now = NOW.getTime()
    const stamps = [
      ...agentops.agentTraces.map((t) => t.startedAt),
      ...agentops.reviewItems.map((r) => r.created),
      ...audit.auditEvents.map((e) => e.at),
      ...guardrails.guardrailViolations.map((v) => v.time),
      ...schedules.scheduledRuns.map((r) => r.startedAt),
      ...deployments.releases.map((r) => r.createdAt),
      ...itsm.incidents.map((i) => i.opened),
      ...itom.alerts.map((a) => a.opened),
    ]
    for (const s of stamps)
      expect(new Date(s).getTime()).toBeLessThanOrEqual(now)
  })

  it("derives the agent configuration surface from real records", () => {
    for (const a of agentops.deployedAgents) {
      const c = agentConfig.getAgentOpsConfig(a.id)
      for (const id of c.guardrailIds)
        expect(ids.policy.has(id), `${a.id} ${id}`).toBe(true)
      for (const id of c.knowledgeBaseIds)
        expect(ids.kb.has(id), `${a.id} ${id}`).toBe(true)
    }
  })

  it("schedules the CAB on the configured weekday", () => {
    const next = itsm.nextCab()
    expect(next.getUTCDay()).toBe(cabSchedule.weekday)
    expect(next.getUTCHours()).toBe(cabSchedule.hour)
    expect(next.getTime()).toBeGreaterThan(NOW.getTime())
    expect(next.getTime() - NOW.getTime()).toBeLessThanOrEqual(
      7 * 24 * 3_600_000
    )
  })
})
