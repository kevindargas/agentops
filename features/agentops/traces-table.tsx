"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { ClipboardCheckIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { agentTraces, deployedAgents } from "@/lib/data"
import type { AgentTrace } from "@/lib/types"
import {
  AgentChip,
  fmtCost,
  fmtMs,
  fmtTokens,
  ModelChip,
  ScoreBar,
} from "./shared"

const col = createColumnHelper<DataTableFeatures, AgentTrace>()

export const traceColumns = col.columns([
  col.accessor("id", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trace" />
    ),
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue()}</span>
    ),
    enableHiding: false,
    meta: { width: "w-28", label: "Trace", skeleton: "w-20" },
  }),
  col.accessor("userQuery", {
    header: "Request",
    cell: ({ getValue, row }) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <TruncatedText className="text-sm">{getValue()}</TruncatedText>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AgentChip agentId={row.original.agentId} size="sm" />
          <span aria-hidden>·</span>
          {row.original.channel}
          {row.original.variant && (
            <Badge
              variant="outline"
              className="h-4 px-1 font-mono text-[10px] text-muted-foreground"
            >
              {row.original.variant}
            </Badge>
          )}
        </span>
      </span>
    ),
    enableSorting: false,
    meta: { width: "min-w-72 max-w-xl", label: "Request", skeleton: "w-64" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue, row }) => (
      <span className="flex items-center gap-1.5">
        <StateBadge state={getValue()} />
        {row.original.userFeedback === "down" && (
          <ThumbsDownIcon
            className="size-3.5 text-destructive"
            aria-label="User thumbs-down"
          />
        )}
        {row.original.userFeedback === "up" && (
          <ThumbsUpIcon
            className="size-3.5 text-success"
            aria-label="User thumbs-up"
          />
        )}
      </span>
    ),
    meta: { width: "w-36", label: "Status", skeleton: "w-20 rounded-full" },
  }),
  col.accessor((r) => r.evals.grounded, {
    id: "grounded",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Grounded" />
    ),
    cell: ({ getValue }) => (
      <ScoreBar
        value={getValue()}
        max={1}
        thresholds={{ good: 85, ok: 70 }}
        className="min-w-12"
      />
    ),
    meta: { width: "w-24", label: "Grounded", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("durationMs", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} format={fmtMs} />,
    meta: { width: "w-24", label: "Latency", numeric: true, skeleton: "w-12" },
  }),
  col.accessor((r) => r.tokensIn + r.tokensOut, {
    id: "tokens",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tokens" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtTokens} muted />
    ),
    meta: { width: "w-24", label: "Tokens", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("cost", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => fmtCost(n, 3)} muted />
    ),
    meta: { width: "w-24", label: "Cost", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("modelId", {
    header: "Model",
    cell: ({ getValue }) => (
      <ModelChip modelId={getValue()} className="text-xs" />
    ),
    enableSorting: false,
    meta: { width: "w-44", label: "Model", skeleton: "w-28" },
  }),
  col.accessor("startedAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-32", label: "Started", skeleton: "w-20" },
  }),
])

const facets: FacetDef<AgentTrace>[] = [
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
  {
    id: "status",
    title: "Status",
    options: ["Succeeded", "Needs review", "Reviewed", "Failed"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.status,
  },
  {
    id: "flag",
    title: "Flag",
    options: [
      "Low confidence",
      "Missing citation",
      "Policy: PII",
      "Tool error",
      "Long latency",
    ].map((v) => ({ value: v, label: v })),
    getValue: (r) => r.flags,
  },
  {
    id: "channel",
    title: "Channel",
    options: ["Web", "Slack", "Teams", "Email", "API"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.channel,
  },
  {
    id: "feedback",
    title: "Feedback",
    options: [
      { value: "up", label: "Thumbs up" },
      { value: "down", label: "Thumbs down" },
      { value: "none", label: "No feedback" },
    ],
    getValue: (r) => r.userFeedback ?? "none",
  },
]

export function TracesTable({
  data = agentTraces,
  agentId,
  compact = false,
}: {
  data?: AgentTrace[]
  agentId?: string
  compact?: boolean
}) {
  const scoped = agentId ? data.filter((t) => t.agentId === agentId) : data
  return (
    <DataTable
      columns={traceColumns}
      data={scoped}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.id} ${r.userQuery} ${r.finalAnswer} ${r.sessionId} ${r.flags.join(" ")}`
      }
      searchPlaceholder="Search traces, sessions, text…"
      facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
      initialSorting={[{ id: "startedAt", desc: true }]}
      initialColumnVisibility={{
        modelId: false,
        tokens: !compact,
        cost: !compact,
      }}
      rowHref={(r) => `/agentops/traces/${r.id}`}
      pageSize={compact ? 10 : 20}
      totalLabel="traces"
      density={compact ? "compact" : undefined}
      selectionLabel={(n) => (n === 1 ? "trace" : "traces")}
      bulkActions={(rows, clear) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            toast.success(
              `${rows.length} trace${rows.length === 1 ? "" : "s"} sent to the review queue`
            )
            clear()
          }}
        >
          <ClipboardCheckIcon /> Send to review
        </Button>
      )}
    />
  )
}
