"use client"

import * as React from "react"
import { createColumnHelper, type Row } from "@tanstack/react-table"
import { PlayIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  evalDatasets,
  evalRuns as seed,
  getDataset,
  type EvalRun,
  type EvalRunStatus,
  type EvalTrigger,
} from "@/lib/data/evals"
import { AgentChip, ModelChip, ScoreBar } from "@/features/agentops/shared"
import {
  CasesBar,
  DatasetChip,
  DeltaValue,
  fmtCost,
  fmtDuration,
  PromptChip,
  RunStatusBadge,
  ScoreCell,
} from "./shared"

const col = createColumnHelper<DataTableFeatures, EvalRun>()

const triggers: EvalTrigger[] = ["Manual", "CI", "Scheduled", "Pre-deploy"]
const statuses: EvalRunStatus[] = [
  "Passed",
  "Failed",
  "Running",
  "Queued",
  "Cancelled",
]

const columns = col.columns([
  col.accessor("id", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Run" />
    ),
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-medium">{getValue()}</span>
    ),
    enableHiding: false,
    meta: { width: "w-24", label: "Run", skeleton: "w-16" },
  }),
  col.accessor("agentId", {
    header: "Target",
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-1">
        <AgentChip agentId={row.original.agentId} size="sm" />
        <span className="flex items-center gap-1.5">
          <PromptChip version={row.original.promptVersion} />
          <ModelChip
            modelId={row.original.modelId}
            className="text-[11px] text-muted-foreground"
          />
        </span>
      </div>
    ),
    enableSorting: false,
    meta: { width: "min-w-56", label: "Target", skeleton: "w-40" },
  }),
  col.accessor("datasetId", {
    header: "Dataset",
    cell: ({ getValue }) => (
      <DatasetChip name={getDataset(getValue())?.name ?? getValue()} />
    ),
    enableSorting: false,
    meta: { width: "w-44", label: "Dataset", skeleton: "w-28" },
  }),
  col.accessor("trigger", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trigger" />
    ),
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">{getValue()}</span>
    ),
    meta: { width: "w-24", label: "Trigger", skeleton: "w-14" },
  }),
  col.accessor("composite", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scores" />
    ),
    cell: ({ row }) => {
      const r = row.original
      if (!r.composite) return <NumericCell value={null} />
      return (
        <div className="flex items-center gap-3">
          <ScoreBar
            value={r.composite}
            className="min-w-12"
            label="Composite"
          />
          <span className="hidden flex-wrap gap-1 xl:flex">
            {r.evaluatorIds.slice(0, 4).map((e) => (
              <ScoreCell key={e} evaluatorId={e} value={r.scores[e]} />
            ))}
            {r.evaluatorIds.length > 4 && (
              <span className="inline-flex h-6 items-center px-1 font-mono text-[11px] text-muted-foreground">
                +{r.evaluatorIds.length - 4}
              </span>
            )}
          </span>
        </div>
      )
    },
    meta: { width: "min-w-48", label: "Scores", skeleton: "w-32" },
  }),
  col.accessor("passRate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pass rate" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue() || null}
        format={(n) => `${n}%`}
        className={
          getValue() >= 90
            ? "text-success-text"
            : getValue() >= 80
              ? undefined
              : "text-danger-text"
        }
      />
    ),
    meta: {
      width: "w-24",
      label: "Pass rate",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("delta", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Δ baseline" />
    ),
    cell: ({ getValue }) => (
      <span className="flex justify-end">
        <DeltaValue value={getValue()} />
      </span>
    ),
    sortFn: (
      a: Row<DataTableFeatures, EvalRun>,
      b: Row<DataTableFeatures, EvalRun>
    ) => (a.original.delta ?? -Infinity) - (b.original.delta ?? -Infinity),
    meta: {
      width: "w-24",
      label: "Δ vs baseline",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("cases", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cases" />
    ),
    cell: ({ row }) =>
      row.original.passed + row.original.failed ? (
        <CasesBar passed={row.original.passed} failed={row.original.failed} />
      ) : (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {row.original.cases} queued
        </span>
      ),
    meta: { width: "w-28", label: "Cases", skeleton: "w-16" },
  }),
  col.accessor("durationMs", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue() || null} format={fmtDuration} muted />
    ),
    meta: { width: "w-24", label: "Duration", numeric: true, skeleton: "w-12" },
  }),
  col.accessor("cost", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue() || null}
        format={(n) => fmtCost(n)}
        muted
      />
    ),
    meta: { width: "w-20", label: "Cost", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => <RunStatusBadge status={getValue()} size="sm" />,
    meta: { width: "w-28", label: "Status", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("started", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Started", skeleton: "w-16" },
  }),
  col.accessor("byId", {
    header: "By",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Started by", skeleton: "w-24" },
  }),
])

const facets: FacetDef<EvalRun>[] = [
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
  {
    id: "dataset",
    title: "Dataset",
    options: evalDatasets.map((d) => ({ value: d.id, label: d.name })),
    getValue: (r) => r.datasetId,
  },
  {
    id: "trigger",
    title: "Trigger",
    options: triggers.map((t) => ({ value: t, label: t })),
    getValue: (r) => r.trigger,
  },
  {
    id: "status",
    title: "Status",
    options: statuses.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.status,
  },
]

export function EvalRunsTable({
  agentId,
  datasetId,
}: {
  agentId?: string
  datasetId?: string
}) {
  const data = React.useMemo(
    () =>
      seed.filter(
        (r) =>
          (!agentId || r.agentId === agentId) &&
          (!datasetId || r.datasetId === datasetId)
      ),
    [agentId, datasetId]
  )
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.id} ${getDeployedAgent(r.agentId)?.name ?? ""} ${getDataset(r.datasetId)?.name ?? ""} ${r.promptVersion} ${r.modelId} ${r.trigger} ${r.status}`
      }
      searchPlaceholder="Search runs, agents, prompts…"
      facets={facets.filter(
        (f) =>
          !(agentId && f.id === "agent") && !(datasetId && f.id === "dataset")
      )}
      initialSorting={[{ id: "started", desc: true }]}
      initialColumnVisibility={{ byId: false, durationMs: false }}
      rowHref={(r) => `/agentops/evals/${r.id}`}
      totalLabel="runs"
      selectionLabel={(n) => (n === 1 ? "run" : "runs")}
      emptyTitle="No eval runs yet"
      emptyMessage="Runs appear here when CI, a schedule or a person evaluates a prompt, model or agent against a dataset."
      toolbar={
        <Button
          size="sm"
          onClick={() =>
            toast("Eval run queued", {
              description: "Pick a target and dataset in the run wizard",
            })
          }
        >
          <PlayIcon /> New run
        </Button>
      }
    />
  )
}
