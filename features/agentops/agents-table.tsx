"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { PauseIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import { deployedAgents } from "@/lib/data"
import { formatNumber } from "@/lib/format"
import type { DeployedAgent } from "@/lib/types"
import { fmtCost, fmtMs, FrameworkBadge, ModelChip, ScoreBar } from "./shared"

const col = createColumnHelper<DataTableFeatures, DeployedAgent>()

export const agentColumns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agent" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={row.original.name}
        secondary={`${row.original.team} · ${row.original.version}`}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-56", label: "Agent", skeleton: "w-40" },
  }),
  col.accessor("health", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Health" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-28", label: "Health", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("framework", {
    header: "Framework",
    cell: ({ getValue }) => <FrameworkBadge framework={getValue()} />,
    enableSorting: false,
    meta: { width: "w-28", label: "Framework", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("modelId", {
    header: "Model",
    cell: ({ getValue }) => <ModelChip modelId={getValue()} />,
    enableSorting: false,
    meta: { width: "w-44", label: "Model", skeleton: "w-32" },
  }),
  col.accessor((r) => r.metrics.requests24h, {
    id: "requests",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Requests · 24h" />
    ),
    cell: ({ getValue, row }) => (
      <span className="flex items-center justify-end gap-2">
        <Sparkline
          data={row.original.trafficTrend}
          className="h-5 w-16"
          showArea={false}
          showEndDot={false}
          color="var(--muted-foreground)"
        />
        <NumericCell
          value={getValue()}
          format={(n) => formatNumber(n)}
          className="w-14"
        />
      </span>
    ),
    meta: { width: "w-40", label: "Requests", numeric: true, skeleton: "w-20" },
  }),
  col.accessor((r) => r.metrics.quality, {
    id: "quality",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quality" />
    ),
    cell: ({ getValue, row }) => (
      <span className="flex items-center justify-end gap-2">
        <Sparkline
          data={row.original.qualityTrend}
          className="h-5 w-16"
          showArea={false}
          showEndDot={false}
          color="var(--chart-1)"
        />
        <ScoreBar value={getValue()} className="min-w-10" />
      </span>
    ),
    meta: { width: "w-40", label: "Quality", numeric: true, skeleton: "w-20" },
  }),
  col.accessor((r) => r.metrics.p95Ms, {
    id: "p95",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="p95" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue() || null} format={fmtMs} />
    ),
    meta: {
      width: "w-24",
      label: "p95 latency",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor((r) => r.metrics.errorRate, {
    id: "errors",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Errors" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => `${n.toFixed(1)}%`}
        className={getValue() > 3 ? "text-danger-text" : undefined}
      />
    ),
    meta: {
      width: "w-24",
      label: "Error rate",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("driftScore", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Drift" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => n.toFixed(2)}
        className={
          getValue() >= 0.25
            ? "text-danger-text"
            : getValue() >= 0.1
              ? "text-warning-text"
              : "text-muted-foreground"
        }
      />
    ),
    meta: {
      width: "w-20",
      label: "Drift (PSI)",
      numeric: true,
      skeleton: "w-8",
    },
  }),
  col.accessor((r) => r.metrics.costPerDay, {
    id: "cost",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost · day" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => fmtCost(n, 0)} />
    ),
    meta: {
      width: "w-28",
      label: "Cost per day",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
  col.accessor("lastDeployed", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Deployed" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Deployed", skeleton: "w-16" },
  }),
])

const facets: FacetDef<DeployedAgent>[] = [
  {
    id: "health",
    title: "Health",
    options: ["Healthy", "Degraded", "Drifting", "Paused"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.health,
  },
  {
    id: "framework",
    title: "Framework",
    options: ["LangGraph", "LangChain", "Custom"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.framework,
  },
  {
    id: "env",
    title: "Environment",
    options: [
      { value: "production", label: "Production" },
      { value: "staging", label: "Staging" },
    ],
    getValue: (r) => r.environment,
  },
  {
    id: "team",
    title: "Team",
    options: [...new Set(deployedAgents.map((a) => a.team))]
      .sort()
      .map((v) => ({ value: v, label: v })),
    getValue: (r) => r.team,
  },
]

export function AgentsTable({
  data = deployedAgents,
}: {
  data?: DeployedAgent[]
}) {
  return (
    <DataTable
      columns={agentColumns}
      data={data}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.name} ${r.team} ${r.modelId} ${r.framework} ${r.tools.join(" ")}`
      }
      searchPlaceholder="Search agents, teams, models…"
      facets={facets}
      initialSorting={[{ id: "requests", desc: true }]}
      initialColumnVisibility={{ ownerId: false, lastDeployed: false }}
      rowHref={(r) => `/agentops/agents/${r.id}`}
      totalLabel="agents"
      selectionLabel={(n) => (n === 1 ? "agent" : "agents")}
      bulkActions={(rows, clear) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast(
                `${rows.length} agent${rows.length === 1 ? "" : "s"} paused`
              )
              clear()
            }}
          >
            <PauseIcon /> Pause
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.success(
                `${rows.length} agent${rows.length === 1 ? "" : "s"} resumed`
              )
              clear()
            }}
          >
            <PlayIcon /> Resume
          </Button>
        </>
      )}
    />
  )
}
