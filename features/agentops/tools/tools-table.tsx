"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { PlusIcon, WrenchIcon } from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StatCard } from "@/components/shared/stat-card"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import {
  mcpServers,
  toolApprovals,
  toolRisks,
  tools as seed,
  toolStats,
  toolStatuses,
  type Tool,
} from "@/lib/data/tools"
import { formatNumber } from "@/lib/format"
import { fmtMs } from "../shared"
import {
  AgentStack,
  ApprovalBadge,
  fmtPct,
  RiskBadge,
  SourceChip,
  sourceKindMeta,
  sourceLabel,
  ToolStatusBadge,
} from "./shared"
import { ToolSheet } from "./tool-sheet"

const col = createColumnHelper<DataTableFeatures, Tool>()
const riskRank: Record<Tool["risk"], number> = {
  Read: 0,
  Write: 1,
  Destructive: 2,
}

function buildColumns(onOpenServer: (id: string) => void) {
  return col.columns([
    col.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tool" />
      ),
      cell: ({ row }) => (
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              "truncate font-mono text-[13px] font-medium",
              row.original.status !== "Active" && "text-muted-foreground"
            )}
            title={row.original.name}
          >
            {row.original.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.original.description}
          </p>
        </div>
      ),
      enableHiding: false,
      meta: { width: "min-w-72 max-w-xl", label: "Tool", skeleton: "w-56" },
    }),
    col.accessor((r) => sourceLabel(r.source), {
      id: "source",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Source" />
      ),
      cell: ({ row }) => (
        <SourceChip source={row.original.source} onServerClick={onOpenServer} />
      ),
      meta: { width: "w-44", label: "Source", skeleton: "w-24" },
    }),
    col.accessor("risk", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Risk" />
      ),
      cell: ({ getValue }) => <RiskBadge risk={getValue()} size="sm" />,
      sortFn: (a, b) => riskRank[a.original.risk] - riskRank[b.original.risk],
      meta: { width: "w-28", label: "Risk", skeleton: "w-16 rounded-full" },
    }),
    col.accessor("approval", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Policy" />
      ),
      cell: ({ getValue }) => <ApprovalBadge approval={getValue()} size="sm" />,
      meta: {
        width: "w-36",
        label: "Approval policy",
        skeleton: "w-24 rounded-full",
      },
    }),
    col.accessor((r) => r.agentIds.length, {
      id: "agents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Agents" />
      ),
      cell: ({ row }) => <AgentStack agentIds={row.original.agentIds} />,
      meta: { width: "w-28", label: "Agents using it", skeleton: "w-16" },
    }),
    col.accessor("calls24h", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Calls · 24h" />
      ),
      cell: ({ getValue, row }) => (
        <span className="flex items-center justify-end gap-2">
          <Sparkline
            data={row.original.calls14d}
            className="h-5 w-14"
            showEndDot={false}
            showArea={false}
            color={
              row.original.status === "Active"
                ? "var(--chart-1)"
                : "var(--muted-foreground)"
            }
          />
          <NumericCell
            value={getValue()}
            format={(n) => formatNumber(n, true)}
            muted={getValue() === 0}
            className="w-10"
          />
        </span>
      ),
      meta: { width: "w-32", label: "Calls", numeric: true, skeleton: "w-16" },
    }),
    col.accessor("errorRate", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Errors" />
      ),
      cell: ({ getValue, row }) => (
        <NumericCell
          value={row.original.calls24h ? getValue() : null}
          format={(n) => fmtPct(n)}
          className={cn(
            getValue() >= 3 && "font-medium text-danger-text",
            getValue() >= 1.5 && getValue() < 3 && "text-warning-text"
          )}
        />
      ),
      meta: {
        width: "w-20",
        label: "Error rate",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    col.accessor("p95Ms", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="p95" />
      ),
      cell: ({ getValue, row }) => (
        <NumericCell
          value={row.original.calls24h ? getValue() : null}
          format={fmtMs}
          muted
        />
      ),
      meta: {
        width: "w-20",
        label: "p95 latency",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    col.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ getValue }) => <ToolStatusBadge status={getValue()} size="sm" />,
      meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
    }),
    col.accessor("ownerId", {
      header: "Owner",
      cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
      enableSorting: false,
      meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
    }),
  ])
}

const facets: FacetDef<Tool>[] = [
  {
    id: "source",
    title: "Source",
    options: [
      ...(Object.keys(sourceKindMeta) as Tool["source"]["kind"][])
        .filter((k) => k !== "mcp")
        .map((k) => ({ value: k, label: sourceKindMeta[k].label })),
      ...mcpServers.map((s) => ({ value: s.id, label: `MCP · ${s.name}` })),
    ],
    getValue: (r) =>
      r.source.kind === "mcp" ? (r.source.serverId ?? "mcp") : r.source.kind,
  },
  {
    id: "risk",
    title: "Risk",
    options: toolRisks.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.risk,
  },
  {
    id: "approval",
    title: "Policy",
    options: toolApprovals.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.approval,
  },
  {
    id: "status",
    title: "Status",
    options: toolStatuses.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.status,
  },
]

export function ToolsTab({
  openName,
  onOpen,
  onOpenServer,
}: {
  openName: string | null
  onOpen: (name: string | null) => void
  onOpenServer: (id: string) => void
}) {
  const [items, setItems] = React.useState<Tool[]>(seed)
  const open = items.find((t) => t.name === openName) ?? null
  const columns = React.useMemo(
    () => buildColumns(onOpenServer),
    [onOpenServer]
  )

  const patch = (name: string, p: Partial<Tool>) =>
    setItems((prev) => prev.map((t) => (t.name === name ? { ...t, ...p } : t)))

  const errorTone = toolStats.errorRate >= 2 ? "warning" : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Tools registered"
          value={items.length}
          hint={`${items.filter((t) => t.status === "Active").length} active · ${items.filter((t) => t.source.kind === "mcp").length} from MCP servers`}
        />
        <StatCard
          size="sm"
          label="Calls · 24h"
          value={formatNumber(toolStats.calls24h, true)}
          sparkline={
            <Sparkline data={toolStats.calls14d} className="h-8 w-full" />
          }
          hint="14-day trend"
        />
        <StatCard
          size="sm"
          label="Error rate"
          value={
            <span className={errorTone && "text-warning-text"}>
              {fmtPct(toolStats.errorRate, 2)}
            </span>
          }
          upIsGood={false}
          hint="Weighted by call volume"
        />
        <StatCard
          size="sm"
          label="Awaiting approval"
          value={items.reduce((n, t) => n + t.pendingApprovals, 0)}
          upIsGood={false}
          hint={`${items.filter((t) => t.approval === "Require approval" && t.status === "Active").length} tools gated by a reviewer`}
        />
      </div>

      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.name}
        getSearchText={(r) =>
          `${r.name} ${r.description} ${sourceLabel(r.source)} ${r.tags.join(" ")} ${r.risk} ${r.approval}`
        }
        searchPlaceholder="Search tools, servers, tags…"
        facets={facets}
        initialSorting={[{ id: "calls24h", desc: true }]}
        initialColumnVisibility={{ ownerId: false }}
        onRowClick={(r) => onOpen(r.name)}
        totalLabel="tools"
        selectionLabel={(n) => (n === 1 ? "tool" : "tools")}
        emptyIcon={<WrenchIcon />}
        toolbar={
          <Button size="sm" onClick={() => toast("Tool registration opened")}>
            <PlusIcon /> Register tool
          </Button>
        }
      />
      <ToolSheet
        tool={open}
        onClose={() => onOpen(null)}
        onPatch={patch}
        onOpenTool={onOpen}
        onOpenServer={onOpenServer}
      />
    </div>
  )
}
