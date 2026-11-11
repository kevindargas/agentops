"use client"

import * as React from "react"

import { setQueryParams } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { evalRuns, evaluators } from "@/lib/data/evals"
import { DatasetsTable } from "./datasets-table"
import { EvaluatorsTable } from "./evaluators-table"
import { ReleaseGates } from "./gates"
import { EvalRunsTable } from "./runs-table"
import { datasetStore, gateStore } from "./store"

import type { EvalsTab } from "./format"

/**
 * Tab shell for /agentops/evals. The URL is the source of truth: `EvalsRoute`
 * reads `?tab=`, `?dataset=`, `?run=` and `?agent=` and passes them in, and
 * every tab change or sheet open is written back with `setQueryParams` (no
 * navigation) so links stay shareable and the page updates in place.
 */
export function EvalsTabs({
  tab = "runs",
  datasetId = null,
  runId = null,
  agentId = null,
}: {
  /** `?tab=`, already validated with `isEvalsTab`. */
  tab?: EvalsTab
  /** `?dataset=<id>`: the dataset whose sheet is open. */
  datasetId?: string | null
  /** `?run=<ev-id>`: highlight and scroll to one run (releases link here). */
  runId?: string | null
  /** `?agent=<agt-id>`: pre-select the Agent facet on the Runs tab. */
  agentId?: string | null
}) {
  const datasets = datasetStore.use()
  const gates = gateStore.use()

  const sync = (
    nextTab: EvalsTab,
    nextDataset: string | null,
    nextRun: string | null
  ) => {
    setQueryParams({
      tab: nextTab === "runs" ? null : nextTab,
      dataset: nextDataset,
      run: nextRun,
      agent: nextTab === "runs" ? agentId : null,
    })
  }

  const failingGates = gates.filter((g) => g.status === "Failed").length

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        const next = v as EvalsTab
        sync(
          next,
          next === "datasets" ? datasetId : null,
          next === "runs" ? runId : null
        )
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
        <Trigger value="datasets" count={datasets.length}>
          Datasets
        </Trigger>
        <Trigger value="evaluators" count={evaluators.length}>
          Evaluators
        </Trigger>
        <Trigger
          value="gates"
          count={failingGates}
          tone={failingGates > 0 ? "danger" : undefined}
          countLabel="failing"
        >
          Gates
        </Trigger>
      </TabsList>
      <TabsContent value="runs">
        <EvalRunsTable
          // The facet is seeded once per `?agent=`; the table never writes
          // that param itself, so the key only changes on navigation.
          key={agentId ?? ""}
          initialFacets={agentId ? { agent: [agentId] } : undefined}
          linkedRunId={runId}
          onClearLinked={() => sync("runs", null, null)}
        />
      </TabsContent>
      <TabsContent value="datasets">
        <DatasetsTable
          openId={datasetId}
          onOpenChange={(id) => sync("datasets", id, null)}
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
  tone,
  countLabel,
  children,
}: {
  value: EvalsTab
  count?: number
  tone?: "danger"
  countLabel?: string
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
    >
      {children}
      {count !== undefined && count > 0 && (
        <CountPill
          count={count}
          tone={tone ?? "muted"}
          label={countLabel}
          className={
            tone
              ? undefined
              : "transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background"
          }
        />
      )}
    </TabsTrigger>
  )
}
