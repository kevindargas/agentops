"use client"

import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { evalRuns } from "@/lib/data/evals"
import { NOW } from "@/lib/data/seed"
import { formatCost, formatNumber } from "@/lib/format"
import { datasetStore, gateStore } from "./store"

const weekAgo = NOW.getTime() - 7 * 86_400_000
const recent = evalRuns.filter((r) => new Date(r.started).getTime() >= weekAgo)
const decided = recent.filter(
  (r) => r.status === "Passed" || r.status === "Failed"
)
const passed = decided.filter((r) => r.status === "Passed").length
const passRate = decided.length
  ? Math.round((passed / decided.length) * 100)
  : 0
const regressions = decided.reduce((n, r) => n + r.regressions, 0)
const regressedRuns = decided.filter((r) => r.regressions > 0).length
const judgeCost = recent.reduce((n, r) => n + r.cost, 0)
const inFlight = recent.filter(
  (r) => r.status === "Running" || r.status === "Queued"
).length

/**
 * KPI row for the evals page. Runs are read-only in the template, so those
 * figures are computed once; datasets and gates read the client stores so
 * cases added from the review queue and gate toggles move the numbers.
 */
export function EvalsStats() {
  const datasets = datasetStore.use()
  const gates = gateStore.use()
  const totalCases = datasets.reduce((n, d) => n + d.cases, 0)
  const gatesFailing = gates.filter((g) => g.status === "Failed").length
  return (
    <StatGrid columns={5}>
      <StatCard
        label="Eval runs · 7d"
        value={recent.length}
        hint={`${inFlight} in flight`}
      />
      <StatCard
        label="Pass rate · 7d"
        value={`${passRate}%`}
        hint={`${passed} of ${decided.length} completed runs passed`}
      />
      <StatCard
        label="Regressions caught"
        value={regressions}
        upIsGood={false}
        hint={`${regressedRuns} ${regressedRuns === 1 ? "run" : "runs"} blocked · ${gatesFailing} ${gatesFailing === 1 ? "gate" : "gates"} failing`}
        href="/agentops/evals?tab=gates"
      />
      <StatCard
        label="Datasets"
        value={datasets.length}
        hint={`${formatNumber(totalCases)} golden cases`}
        href="/agentops/evals?tab=datasets"
      />
      <StatCard
        label="Judge cost · 7d"
        value={formatCost(judgeCost, 0)}
        hint={`${formatCost(judgeCost / Math.max(1, recent.length))} per run`}
      />
    </StatGrid>
  )
}
