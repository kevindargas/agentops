"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  evalDatasets,
  evalRuns,
  evaluators,
  releaseGates,
} from "@/lib/data/evals"
import { DatasetsTable } from "./datasets-table"
import { EvaluatorsTable } from "./evaluators-table"
import { ReleaseGates } from "./gates"
import { EvalRunsTable } from "./runs-table"

import type { EvalsTab } from "./format"

/**
 * Tab shell for /agentops/evals. The server page reads `?tab=` and
 * `?dataset=` once; from then on state is local and mirrored back into the
 * URL with `router.replace` so links stay shareable without `useSearchParams`.
 */
export function EvalsTabs({
  initialTab = "runs",
  initialDatasetId = null,
}: {
  initialTab?: EvalsTab
  initialDatasetId?: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = React.useState<EvalsTab>(initialTab)
  const [datasetId, setDatasetId] = React.useState<string | null>(
    initialDatasetId
  )

  const sync = (nextTab: EvalsTab, nextDataset: string | null) => {
    const q = new URLSearchParams()
    if (nextTab !== "runs") q.set("tab", nextTab)
    if (nextDataset) q.set("dataset", nextDataset)
    router.replace(`/agentops/evals${q.size ? `?${q}` : ""}`, {
      scroll: false,
    })
  }

  const failingGates = releaseGates.filter((g) => g.status === "Failed").length

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        const next = v as EvalsTab
        setTab(next)
        sync(next, next === "datasets" ? datasetId : null)
      }}
      className="gap-4"
    >
      <TabsList
        variant="line"
        className="h-9 w-full justify-start border-b p-0"
      >
        <Trigger value="runs" count={evalRuns.length}>
          Runs
        </Trigger>
        <Trigger value="datasets" count={evalDatasets.length}>
          Datasets
        </Trigger>
        <Trigger value="evaluators" count={evaluators.length}>
          Evaluators
        </Trigger>
        <Trigger value="gates" count={failingGates} countTone="danger">
          Gates
        </Trigger>
      </TabsList>
      <TabsContent value="runs">
        <EvalRunsTable />
      </TabsContent>
      <TabsContent value="datasets">
        <DatasetsTable
          openId={datasetId}
          onOpenChange={(id) => {
            setDatasetId(id)
            sync("datasets", id)
          }}
        />
      </TabsContent>
      <TabsContent value="evaluators">
        <EvaluatorsTable />
      </TabsContent>
      <TabsContent value="gates">
        <ReleaseGates />
      </TabsContent>
    </Tabs>
  )
}

function Trigger({
  value,
  count,
  countTone,
  children,
}: {
  value: EvalsTab
  count?: number
  countTone?: "danger"
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={
            countTone === "danger"
              ? "rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-danger-text tabular-nums"
              : "rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background"
          }
        >
          {count}
        </span>
      )}
    </TabsTrigger>
  )
}
