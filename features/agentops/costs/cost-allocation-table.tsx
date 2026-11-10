"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { deployedAgents } from "@/lib/data"
import { costByAgent, type AgentCost } from "@/lib/data/costs"
import { formatDelta, formatNumber } from "@/lib/format"
import { fmtTokens, ModelChip, modelDisplayName } from "../shared"
import { downloadText, fmtPerRequest, fmtUsd, toCsv } from "./shared"

const col = createColumnHelper<DataTableFeatures, AgentCost>()

const agentName = (id: string) =>
  deployedAgents.find((a) => a.id === id)?.name ?? id

const columns = col.columns([
  col.accessor((r) => agentName(r.agentId), {
    id: "agent",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agent" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={agentName(row.original.agentId)}
        secondary={row.original.team}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-48", label: "Agent", skeleton: "w-32" },
  }),
  col.accessor("modelId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ getValue }) => (
      <ModelChip modelId={getValue()} className="text-xs" />
    ),
    meta: { width: "w-44", label: "Model", skeleton: "w-28" },
  }),
  col.accessor("requests", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Requests" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatNumber(n)} />
    ),
    meta: { width: "w-28", label: "Requests", numeric: true, skeleton: "w-12" },
  }),
  col.accessor("tokensIn", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tokens in" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtTokens} muted />
    ),
    meta: {
      width: "w-24",
      label: "Tokens in",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("tokensOut", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tokens out" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtTokens} muted />
    ),
    meta: {
      width: "w-24",
      label: "Tokens out",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("tokensCached", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cached" />
    ),
    cell: ({ getValue, row }) => {
      const total = row.original.tokensIn + row.original.tokensCached || 1
      return (
        <NumericCell
          value={getValue()}
          format={(n) => `${fmtTokens(n)} · ${Math.round((n / total) * 100)}%`}
          muted
        />
      )
    },
    meta: {
      width: "w-28",
      label: "Cached tokens",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor("cost", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost · 7d" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtUsd} className="font-medium" />
    ),
    meta: {
      width: "w-28",
      label: "Cost (7d)",
      numeric: true,
      skeleton: "w-14",
    },
  }),
  col.accessor("costPerRequest", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost / request" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtPerRequest} />
    ),
    meta: {
      width: "w-28",
      label: "Cost per request",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor("deltaPct", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Δ vs last week" />
    ),
    cell: ({ getValue }) => {
      const v = getValue()
      return (
        <NumericCell
          value={v}
          format={(n) => formatDelta(n, "%", 1)}
          className={cn(
            Math.abs(v) < 1
              ? "text-muted-foreground"
              : v > 0
                ? "text-danger-text"
                : "text-success-text"
          )}
        />
      )
    },
    meta: {
      width: "w-28",
      label: "Δ vs last week",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("share", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Share" />
    ),
    cell: ({ getValue }) => (
      <span className="flex items-center justify-end gap-2">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-chart-1"
            style={{ width: `${Math.min(100, getValue())}%` }}
          />
        </span>
        <span className="w-10 text-right text-xs tabular-nums">
          {getValue().toFixed(1)}%
        </span>
      </span>
    ),
    meta: {
      width: "w-32",
      label: "Share of total",
      numeric: true,
      skeleton: "w-20",
    },
  }),
])

const facets: FacetDef<AgentCost>[] = [
  {
    id: "team",
    title: "Team",
    options: Array.from(new Set(costByAgent.map((r) => r.team))).map((t) => ({
      value: t,
      label: t,
    })),
    getValue: (r) => r.team,
  },
  {
    id: "model",
    title: "Model",
    options: Array.from(new Set(costByAgent.map((r) => r.modelId))).map(
      (m) => ({ value: m, label: modelDisplayName(m) })
    ),
    getValue: (r) => r.modelId,
  },
]

function exportCsv() {
  const csv = toCsv(
    costByAgent.map((r) => ({
      agent: agentName(r.agentId),
      agent_id: r.agentId,
      team: r.team,
      model: r.modelId,
      requests_7d: r.requests,
      tokens_in: r.tokensIn,
      tokens_out: r.tokensOut,
      tokens_cached: r.tokensCached,
      cost_usd_7d: r.cost.toFixed(2),
      cost_per_request_usd: r.costPerRequest.toFixed(5),
      delta_vs_last_week_pct: r.deltaPct.toFixed(1),
      share_pct: r.share.toFixed(1),
    }))
  )
  downloadText("agentops-cost-allocation.csv", csv)
  toast.success("CSV exported", {
    description: `${costByAgent.length} agents · last 7 days`,
  })
}

export function CostAllocationTable() {
  return (
    <DataTable
      columns={columns}
      data={costByAgent}
      getRowId={(r) => r.agentId}
      getSearchText={(r) => `${agentName(r.agentId)} ${r.team} ${r.modelId}`}
      searchPlaceholder="Search agents…"
      facets={facets}
      initialSorting={[{ id: "cost", desc: true }]}
      initialColumnVisibility={{ tokensOut: false }}
      rowHref={(r) => `/agentops/agents/${r.agentId}`}
      totalLabel="agents"
      selectionLabel={(n) => (n === 1 ? "agent" : "agents")}
      hidePagination
      toolbar={
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <DownloadIcon /> Export CSV
        </Button>
      }
    />
  )
}
