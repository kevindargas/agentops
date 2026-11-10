import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { TracesTable } from "@/features/agentops/traces-table"
import {
  agentTraces,
  getDeployedAgent,
  telemetryHealth,
} from "@/lib/data/agentops"
import { getGuardrail, guardrailViolations } from "@/lib/data/guardrails"
import { formatCost, formatMs, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Traces" }

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{
    agent?: string
    status?: string
    outcome?: string
    flag?: string
    /** Guardrail policy id: only traces with a violation of that policy. */
    policy?: string
    /** `p-N` selects the Prompt version facet; anything else the build Version facet. */
    version?: string
  }>
}) {
  const {
    agent: agentId,
    status,
    outcome,
    flag,
    policy: policyId,
    version,
  } = await searchParams
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
  const sorted = [...scoped].sort((a, b) => a.durationMs - b.durationMs)
  const p95 = sorted[Math.floor(sorted.length * 0.95)]?.durationMs ?? 0
  const failed = scoped.filter((t) => t.status === "Failed").length
  const review = scoped.filter((t) => t.status === "Needs review").length
  const initialFacets: Record<string, string[]> = {}
  if (status) initialFacets.status = [status]
  if (outcome) initialFacets.outcome = [outcome]
  if (flag) initialFacets.flag = [flag]
  if (version)
    initialFacets[version.startsWith("p-") ? "promptVersion" : "version"] = [
      version,
    ]
  const facetKey = `${agentId ?? "all"}:${policy?.id ?? ""}:${status ?? ""}:${outcome ?? ""}:${flag ?? ""}:${version ?? ""}`

  return (
    <>
      <PageHeader
        nav="/agentops/traces"
        title={
          agent
            ? `Traces · ${agent.name}`
            : policy
              ? `Traces · ${policy.name}`
              : undefined
        }
        description={
          policy
            ? `Runs with at least one ${policy.name} violation in the sampled window. Open a trace for the full waterfall and the flagged span.`
            : "One row per agent run across every framework, with spans, tokens, cost and evaluator scores. Open a trace for the full LangGraph waterfall and the final answer."
        }
      />
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
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <TracesTable
          key={facetKey}
          data={policyTraceIds ? scoped : undefined}
          agentId={agent?.id}
          initialFacets={
            Object.keys(initialFacets).length ? initialFacets : undefined
          }
        />
      </Suspense>
    </>
  )
}
