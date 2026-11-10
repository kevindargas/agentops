import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { EvalsStats } from "@/features/agentops/evals/evals-stats"
import { EvalsTabs } from "@/features/agentops/evals/evals-tabs"
import { isEvalsTab } from "@/features/agentops/evals/format"
import { getDeployedAgent } from "@/lib/data/agentops"
import { getDataset, getEvalRun } from "@/lib/data/evals"

export const metadata: Metadata = { title: "Evals & Datasets" }

export default async function EvalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    dataset?: string
    run?: string
    agent?: string
  }>
}) {
  const { tab, dataset, run, agent } = await searchParams
  const datasetId = dataset && getDataset(dataset) ? dataset : null
  const runId = run && getEvalRun(run) ? run : null
  const agentId = agent && getDeployedAgent(agent) ? agent : null
  const initialTab = isEvalsTab(tab) ? tab : datasetId ? "datasets" : "runs"

  return (
    <>
      <PageHeader
        nav="/agentops/evals"
        description="Regression tests for prompts, models and agents. Every candidate runs against a golden set, each case is scored by LLM judges and code evaluators, and release gates, when defined, decide whether it can be promoted."
      />
      <EvalsStats />
      <EvalsTabs
        key={`${initialTab}:${datasetId ?? ""}:${runId ?? ""}:${agentId ?? ""}`}
        initialTab={initialTab}
        initialDatasetId={datasetId}
        initialRunId={initialTab === "runs" ? runId : null}
        initialAgentId={initialTab === "runs" ? agentId : null}
      />
    </>
  )
}
