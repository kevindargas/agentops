import type { Metadata } from "next"
import { FlaskRoundIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EvalsTabs } from "@/features/agentops/evals/evals-tabs"
import { fmtCost, isEvalsTab } from "@/features/agentops/evals/format"
import { NOW } from "@/lib/data/seed"
import {
  evalDatasets,
  evalRuns,
  getDataset,
  releaseGates,
} from "@/lib/data/evals"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Evals & Datasets" }

export default async function EvalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dataset?: string }>
}) {
  const { tab, dataset } = await searchParams
  const datasetId = dataset && getDataset(dataset) ? dataset : null
  const initialTab = isEvalsTab(tab) ? tab : datasetId ? "datasets" : "runs"

  const weekAgo = NOW.getTime() - 7 * 86_400_000
  const recent = evalRuns.filter(
    (r) => new Date(r.started).getTime() >= weekAgo
  )
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
  const totalCases = evalDatasets.reduce((n, d) => n + d.cases, 0)
  const gatesFailing = releaseGates.filter((g) => g.status === "Failed").length

  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<FlaskRoundIcon />}
        title="Evals & Datasets"
        description="Regression tests for prompts, models and agents. Every candidate runs against a golden dataset, each case is scored by LLM judges and code evaluators, and release gates decide whether it can be promoted."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          size="sm"
          label="Eval runs · 7d"
          value={recent.length}
          hint={`${recent.filter((r) => r.status === "Running" || r.status === "Queued").length} in flight`}
        />
        <StatCard
          size="sm"
          label="Pass rate · 7d"
          value={`${passRate}%`}
          hint={`${passed} of ${decided.length} completed runs passed`}
        />
        <StatCard
          size="sm"
          label="Regressions caught"
          value={regressions}
          upIsGood={false}
          hint={`${regressedRuns} ${regressedRuns === 1 ? "run" : "runs"} blocked · ${gatesFailing} gates failing`}
        />
        <StatCard
          size="sm"
          label="Datasets"
          value={evalDatasets.length}
          hint={`${formatNumber(totalCases)} golden cases`}
        />
        <StatCard
          size="sm"
          label="Judge cost · 7d"
          value={fmtCost(judgeCost, 0)}
          hint={`${fmtCost(judgeCost / Math.max(1, recent.length))} per run`}
        />
      </div>
      <EvalsTabs
        key={`${initialTab}:${datasetId ?? ""}`}
        initialTab={initialTab}
        initialDatasetId={datasetId}
      />
    </>
  )
}
