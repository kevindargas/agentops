"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import {
  agentTraces,
  getDeployedAgent,
  telemetryHealth,
} from "@/lib/data/agentops"
import { getGuardrail, guardrailViolations } from "@/lib/data/guardrails"
import { formatCost, formatMs, formatNumber } from "@/lib/format"
import { TracesTable } from "./traces-table"

const DEFAULT_DESCRIPTION =
  "One row per agent run across every framework, with spans, tokens, cost and evaluator scores. Open a trace for the full LangGraph waterfall and the final answer."

/**
 * Resolves the URL scope of the Traces list: `?agent=` narrows to one agent,
 * `?policy=` to runs with a violation of that guardrail, and `?status=`,
 * `?outcome=`, `?flag=` and `?version=` preselect facets (`p-N` selects the
 * Prompt version facet, anything else the build Version facet).
 */
function useTracesScope() {
  const params = useSearchParams()
  const agentId = params.get("agent")
  const policyId = params.get("policy")
  const status = params.get("status")
  const outcome = params.get("outcome")
  const flag = params.get("flag")
  const version = params.get("version")

  const agent = agentId ? getDeployedAgent(agentId) : undefined
  const policy = policyId ? getGuardrail(policyId) : undefined
  const policyTraceIds = policy
    ? new Set(
        guardrailViolations
          .filter((v) => v.policyId === policy.id)
          .map((v) => v.traceId)
      )
    : null
  const scoped = agentTraces.filter(
    (t) =>
      (!agent || t.agentId === agent.id) &&
      (!policyTraceIds || policyTraceIds.has(t.id))
  )
  const initialFacets: Record<string, string[]> = {}
  if (status) initialFacets.status = [status]
  if (outcome) initialFacets.outcome = [outcome]
  if (flag) initialFacets.flag = [flag]
  if (version)
    initialFacets[version.startsWith("p-") ? "promptVersion" : "version"] = [
      version,
    ]
  const facetKey = `${agentId ?? "all"}:${policy?.id ?? ""}:${status ?? ""}:${outcome ?? ""}:${flag ?? ""}:${version ?? ""}`

  return {
    agent,
    policy,
    policyTraceIds,
    scoped,
    initialFacets: Object.keys(initialFacets).length
      ? initialFacets
      : undefined,
    facetKey,
  }
}

function Title() {
  const { agent, policy } = useTracesScope()
  return (
    <>
      {agent
        ? `Traces · ${agent.name}`
        : policy
          ? `Traces · ${policy.name}`
          : "Traces"}
    </>
  )
}

/** "Traces · <agent>" or "Traces · <policy>" when the list is scoped. */
export function TracesTitle() {
  return (
    <Suspense fallback="Traces">
      <Title />
    </Suspense>
  )
}

function Description() {
  const { policy } = useTracesScope()
  return (
    <>
      {policy
        ? `Runs with at least one ${policy.name} violation in the sampled window. Open a trace for the full waterfall and the flagged span.`
        : DEFAULT_DESCRIPTION}
    </>
  )
}

/** Header description; names the guardrail policy when `?policy=` is set. */
export function TracesDescription() {
  return (
    <Suspense fallback={DEFAULT_DESCRIPTION}>
      <Description />
    </Suspense>
  )
}

/**
 * Stat row plus table for the Traces list page. Must sit inside `<Suspense>`:
 * it reads the URL once and keys the table on the scope so a new deep link
 * resets search, facets and paging.
 */
export function TracesView() {
  const { agent, policyTraceIds, scoped, initialFacets, facetKey } =
    useTracesScope()
  const sorted = [...scoped].sort((a, b) => a.durationMs - b.durationMs)
  const p95 = sorted[Math.floor(sorted.length * 0.95)]?.durationMs ?? 0
  const failed = scoped.filter((t) => t.status === "Failed").length
  const review = scoped.filter((t) => t.status === "Needs review").length

  return (
    <>
      <StatGrid columns={4}>
        <StatCard
          label="Traces · 48h"
          value={formatNumber(scoped.length)}
          hint={`Sampled at ${telemetryHealth.sampleRate}% · ${telemetryHealth.traceCoverage}% complete`}
        />
        <StatCard
          label="p95 latency"
          value={formatMs(p95)}
          hint="1 in 20 runs is slower than this"
        />
        <StatCard
          label="Failed"
          value={failed}
          upIsGood={false}
          hint={`${((failed / Math.max(1, scoped.length)) * 100).toFixed(1)}% of runs`}
        />
        <StatCard
          label="Spend"
          value={formatCost(scoped.reduce((s, t) => s + t.cost, 0))}
          hint={`${review} awaiting human review`}
        />
      </StatGrid>
      <TracesTable
        key={facetKey}
        data={policyTraceIds ? scoped : undefined}
        agentId={agent?.id}
        initialFacets={initialFacets}
      />
    </>
  )
}
