"use client"

import { useSearchParams } from "next/navigation"

import { getDeployedAgent } from "@/lib/data/agentops"
import { getDataset, getEvalRun } from "@/lib/data/evals"
import { EvalsTabs } from "./evals-tabs"
import { isEvalsTab } from "./format"

/**
 * Client entry for /agentops/evals. Reads `?tab=`, `?dataset=`, `?run=` and
 * `?agent=` through `useSearchParams` (the page wraps it in `<Suspense>` with
 * the table skeleton) so the server page stays static. Unknown ids are
 * dropped; a `?dataset=` without `?tab=` lands on the Datasets tab; `?run=`
 * and `?agent=` only apply on the Runs tab.
 */
export function EvalsRoute() {
  const params = useSearchParams()
  const tab = params.get("tab") ?? undefined
  const dataset = params.get("dataset")
  const run = params.get("run")
  const agent = params.get("agent")

  const datasetId = dataset && getDataset(dataset) ? dataset : null
  const runId = run && getEvalRun(run) ? run : null
  const agentId = agent && getDeployedAgent(agent) ? agent : null
  const activeTab = isEvalsTab(tab) ? tab : datasetId ? "datasets" : "runs"

  return (
    <EvalsTabs
      tab={activeTab}
      datasetId={datasetId}
      runId={activeTab === "runs" ? runId : null}
      agentId={activeTab === "runs" ? agentId : null}
    />
  )
}
