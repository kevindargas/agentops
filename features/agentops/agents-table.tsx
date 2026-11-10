"use client"

import * as React from "react"
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
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deployedAgents, openDriftSeverity } from "@/lib/data/agentops"
import { formatCost, formatMs, formatNumber } from "@/lib/format"
import type { DeployedAgent } from "@/lib/types"
import { FrameworkBadge, ModelChip, ScoreBar } from "./shared"
import { agentStore } from "./stores"

const col = createColumnHelper<DataTableFeatures, DeployedAgent>()

/** Colour for the Drift cell: open signal severity first, then PSI thresholds. */
function driftClass(agent: DeployedAgent) {
  const open = openDriftSeverity(agent.id)
  if (open === "Critical" || agent.driftScore >= 0.25) return "text-danger-text"
  if (open === "Warning" || agent.driftScore >= 0.1) return "text-warning-text"
  return "text-muted-foreground"
}

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
    cell: ({ getValue, row }) =>
      row.original.paused ? (
        <span title={row.original.pausedReason}>
          <StateBadge state="Paused" icon={<PauseIcon className="size-3" />} />
        </span>
      ) : (
        <StateBadge state={getValue()} />
      ),
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
      <DataTableColumnHeader
        column={column}
        title="Quality"
        hint="Traffic-weighted evaluator composite, 0 to 100, with the 14-day trend."
      />
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
      <DataTableColumnHeader
        column={column}
        title="p95"
        hint="95th percentile run latency over the last 24 hours: 1 in 20 runs is slower than this."
      />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue() || null} format={formatMs} />
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
      <DataTableColumnHeader
        column={column}
        title="Drift"
        hint="Population stability index of inputs against the 28-day baseline. Amber from 0.10, red from 0.25 or when the agent has an open drift signal of that severity."
      />
    ),
    cell: ({ getValue, row }) => (
      <NumericCell
        value={getValue()}
        format={(n) => n.toFixed(2)}
        className={driftClass(row.original)}
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
      <NumericCell value={getValue()} format={(n) => formatCost(n, 0)} />
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
    getValue: (r) => (r.paused ? "Paused" : r.health),
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

/** Stat row for the Agents page, read from the same store as the table. */
export function AgentStats() {
  const agents = agentStore.use()
  const prod = agents.filter((a) => a.environment === "production")
  const byFramework = (f: DeployedAgent["framework"]) =>
    agents.filter((a) => a.framework === f).length
  const attention = agents.filter(
    (a) => a.paused || a.health === "Drifting" || a.health === "Degraded"
  ).length
  return (
    <StatGrid columns={4}>
      <StatCard
        label="Deployed"
        value={agents.length}
        hint={`${prod.length} production · ${agents.length - prod.length} staging`}
      />
      <StatCard
        label="LangGraph"
        value={byFramework("LangGraph")}
        hint={`${byFramework("LangChain")} LangChain · ${byFramework("Custom")} custom`}
      />
      <StatCard
        label="Requests · 24h"
        value={formatNumber(
          prod.reduce((s, a) => s + a.metrics.requests24h, 0),
          true
        )}
        hint="Across production agents"
      />
      <StatCard
        label="Needs attention"
        value={attention}
        upIsGood={false}
        hint="Drifting, degraded or paused"
      />
    </StatGrid>
  )
}

export function AgentsTable() {
  const agents = agentStore.use()
  const [pendingPause, setPendingPause] = React.useState<DeployedAgent[]>([])

  const pause = (list: DeployedAgent[]) => {
    for (const a of list)
      agentStore.patch(a.id, {
        paused: true,
        pausedReason: "Paused from the agents list",
      })
    toast(`${plural(list)} paused`, {
      description:
        "No new runs are accepted; in-flight runs finish and schedules are skipped.",
      action: {
        label: "Undo",
        onClick: () => {
          for (const a of list)
            agentStore.patch(a.id, {
              paused: a.paused,
              pausedReason: a.pausedReason,
            })
        },
      },
      duration: 6000,
    })
  }
  const resume = (list: DeployedAgent[]) => {
    for (const a of list)
      agentStore.patch(a.id, { paused: false, pausedReason: undefined })
    toast.success(`${plural(list)} resumed`, {
      description: "New runs are accepted again.",
    })
  }

  return (
    <>
      <DataTable
        columns={agentColumns}
        data={agents}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.team} ${r.modelId} ${r.framework} ${r.tools.join(" ")} ${r.paused ? "paused" : ""}`
        }
        searchPlaceholder="Search agents, teams, models…"
        facets={facets}
        initialSorting={[{ id: "requests", desc: true }]}
        initialColumnVisibility={{ ownerId: false, lastDeployed: false }}
        rowHref={(r) => `/agentops/agents/${r.id}`}
        totalLabel="agents"
        caption="Deployed agents"
        selectionLabel={(n) => (n === 1 ? "agent" : "agents")}
        bulkActions={(rows, clear) => {
          const selected = rows.map((r) => r.original)
          const running = selected.filter((r) => !r.paused)
          const paused = selected.filter((r) => r.paused)
          return (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={running.length === 0}
                onClick={() => {
                  setPendingPause(running)
                  clear()
                }}
              >
                <PauseIcon /> Pause
                {running.length > 0 && running.length < rows.length && (
                  <span className="text-muted-foreground tabular-nums">
                    {running.length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={paused.length === 0}
                onClick={() => {
                  resume(paused)
                  clear()
                }}
              >
                <PlayIcon /> Resume
                {paused.length > 0 && paused.length < rows.length && (
                  <span className="text-muted-foreground tabular-nums">
                    {paused.length}
                  </span>
                )}
              </Button>
            </>
          )
        }}
      />
      <AlertDialog
        open={pendingPause.length > 0}
        onOpenChange={(o) => !o && setPendingPause([])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause {plural(pendingPause)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPause.map((a) => a.name).join(", ")} will stop accepting
              new runs. In-flight runs finish normally, schedules and triggers
              are skipped until you resume.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                pause(pendingPause)
                setPendingPause([])
              }}
            >
              Pause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const plural = (xs: DeployedAgent[]) =>
  `${xs.length} agent${xs.length === 1 ? "" : "s"}`
