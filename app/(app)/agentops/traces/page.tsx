import type { Metadata } from "next"
import { RouteIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { fmtCost, fmtMs } from "@/features/agentops/format"
import { TracesTable } from "@/features/agentops/traces-table"
import { agentTraces, getDeployedAgent } from "@/lib/data"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Traces" }

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>
}) {
  const { agent: agentId } = await searchParams
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  const scoped = agent
    ? agentTraces.filter((t) => t.agentId === agent.id)
    : agentTraces
  const sorted = [...scoped].sort((a, b) => a.durationMs - b.durationMs)
  const p95 = sorted[Math.floor(sorted.length * 0.95)]?.durationMs ?? 0
  const failed = scoped.filter((t) => t.status === "Failed").length
  const review = scoped.filter((t) => t.status === "Needs review").length
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<RouteIcon />}
        title={agent ? `Traces · ${agent.name}` : "Traces"}
        description="One row per agent run across every framework, with spans, tokens, cost and evaluator scores. Open a trace for the full LangGraph waterfall and the final answer."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Traces · 48h"
          value={formatNumber(scoped.length)}
          hint="Sampled at 100%"
        />
        <StatCard size="sm" label="p95 latency" value={fmtMs(p95)} />
        <StatCard
          size="sm"
          label="Failed"
          value={failed}
          upIsGood={false}
          hint={`${((failed / Math.max(1, scoped.length)) * 100).toFixed(1)}% of runs`}
        />
        <StatCard
          size="sm"
          label="Spend"
          value={fmtCost(scoped.reduce((s, t) => s + t.cost, 0))}
          hint={`${review} awaiting human review`}
        />
      </div>
      <TracesTable key={agentId ?? "all"} agentId={agent?.id} />
    </>
  )
}
