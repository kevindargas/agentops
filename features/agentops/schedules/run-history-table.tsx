"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { CalendarClockIcon, HistoryIcon, ZapIcon } from "lucide-react"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import { runStatuses, type ScheduledRun } from "@/lib/data/schedules"
import { formatCost, formatDurationMs } from "@/lib/format"
import { AgentChip } from "../shared"
import { AgentDot, RunStatusBadge, TraceLink } from "./shared"
import { runStore } from "./store"

const col = createColumnHelper<DataTableFeatures, ScheduledRun>()

const columns = col.columns([
  col.accessor("id", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Run" />
    ),
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue()}</span>
    ),
    enableHiding: false,
    meta: { width: "w-28", label: "Run", skeleton: "w-16" },
  }),
  col.accessor("sourceName", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Schedule / trigger" />
    ),
    cell: ({ row }) => (
      <span className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-3.5">
          {row.original.source === "schedule" ? (
            <CalendarClockIcon />
          ) : (
            <ZapIcon />
          )}
        </span>
        <TwoLineCell
          primary={row.original.sourceName}
          secondary={`${row.original.source === "schedule" ? "Schedule" : "Trigger"} · ${row.original.sourceId}`}
        />
      </span>
    ),
    meta: { width: "min-w-56 max-w-xs", label: "Source", skeleton: "w-40" },
  }),
  col.accessor("agentId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agent" />
    ),
    cell: ({ getValue }) => (
      <span className="inline-flex items-center gap-2">
        <AgentDot agentId={getValue()} />
        <AgentChip agentId={getValue()} />
      </span>
    ),
    sortFn: (a, b) =>
      (getDeployedAgent(a.original.agentId)?.name ?? "").localeCompare(
        getDeployedAgent(b.original.agentId)?.name ?? ""
      ),
    meta: { width: "w-48", label: "Agent", skeleton: "w-28" },
  }),
  col.accessor("startedAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ getValue }) => (
      <TwoLineCell
        primary={<DateCell value={getValue()} tone="default" />}
        secondary={<DateCell value={getValue()} mode="datetime" />}
      />
    ),
    meta: { width: "w-36", label: "Started", skeleton: "w-20" },
  }),
  col.accessor("durationMs", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Duration"
        hint="Wall-clock time from start to finish. Running runs have no duration yet."
      />
    ),
    cell: ({ getValue, row }) => (
      <NumericCell
        value={getValue() || null}
        format={formatDurationMs}
        muted
        className={cn(row.original.status === "Running" && "text-brand")}
      />
    ),
    meta: { width: "w-24", label: "Duration", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => <RunStatusBadge status={getValue()} />,
    meta: { width: "w-28", label: "Status", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("itemsProcessed", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Items"
        hint="Records the agent reported processing in this run (tickets, documents, alerts)."
      />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue() || null} muted />,
    meta: {
      width: "w-20",
      label: "Items processed",
      numeric: true,
      skeleton: "w-8",
    },
  }),
  col.accessor("cost", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue() || null}
        format={(n) => formatCost(n, 2)}
      />
    ),
    meta: { width: "w-20", label: "Cost", numeric: true, skeleton: "w-10" },
  }),
  col.accessor((r) => r.traceId ?? "", {
    id: "trace",
    header: "Trace",
    cell: ({ row }) => <TraceLink traceId={row.original.traceId} />,
    enableSorting: false,
    meta: { width: "w-28", label: "Trace", skeleton: "w-16" },
  }),
  col.accessor((r) => r.error ?? "", {
    id: "error",
    header: "Error",
    cell: ({ getValue, row }) => {
      const v = getValue()
      if (!v) return <EmptyValue />
      return (
        <span
          className={cn(
            "block max-w-xs truncate text-xs",
            row.original.status === "Failed"
              ? "text-danger-text"
              : "text-muted-foreground"
          )}
          title={v}
        >
          {v}
        </span>
      )
    },
    enableSorting: false,
    meta: { width: "min-w-48 max-w-xs", label: "Error", skeleton: "w-32" },
  }),
])

const facets: FacetDef<ScheduledRun>[] = [
  {
    id: "status",
    title: "Status",
    options: runStatuses.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.status,
  },
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
  {
    id: "source",
    title: "Source",
    options: [
      { value: "schedule", label: "Schedule" },
      { value: "trigger", label: "Trigger" },
    ],
    getValue: (r) => r.source,
  },
]

export function RunHistoryTable({
  agentId,
  initialAgentId,
  sourceId,
  compact,
}: {
  /** Hard filter: hides the agent facet (agent record pages). */
  agentId?: string
  /** Preselects the agent facet (`?agent=` on the list page). */
  initialAgentId?: string
  sourceId?: string
  compact?: boolean
}) {
  const runs = runStore.use()
  let data = runs
  if (agentId) data = data.filter((r) => r.agentId === agentId)
  if (sourceId) data = data.filter((r) => r.sourceId === sourceId)
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.id} ${r.sourceName} ${r.sourceId} ${r.status} ${r.error ?? ""} ${r.traceId ?? ""} ${getDeployedAgent(r.agentId)?.name ?? ""}`
      }
      searchPlaceholder="Search runs…"
      facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
      initialFacets={
        initialAgentId && !agentId ? { agent: [initialAgentId] } : undefined
      }
      initialSorting={[{ id: "startedAt", desc: true }]}
      initialColumnVisibility={
        compact ? { itemsProcessed: false, error: false } : {}
      }
      density={compact ? "compact" : undefined}
      pageSize={compact ? 10 : 25}
      totalLabel="runs"
      caption="Run history across schedules and triggers"
      selectionLabel={(n) => (n === 1 ? "run" : "runs")}
      emptyTitle="No runs yet"
      emptyMessage="Runs appear here once a schedule fires or a trigger matches."
      emptyIcon={<HistoryIcon />}
    />
  )
}
