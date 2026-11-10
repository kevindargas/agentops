"use client"

import { useRouter } from "next/navigation"
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
import { agentTraces, deployedAgents, traceFlags } from "@/lib/data/agentops"
import { formatCost, formatMs, formatTokens } from "@/lib/format"
import type { AgentTrace, BoundHit } from "@/lib/types"
import {
  AgentChip,
  BoundHitFlag,
  ModelChip,
  OutcomeBadge,
  outcomeLabel,
  outcomeOrder,
  ScoreBar,
} from "./shared"
import { queueTraceForReview } from "./stores"

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
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <AgentChip agentId={row.original.agentId} size="sm" />
          <span aria-hidden>·</span>
          {row.original.channel}
          {row.original.variant && (
            <Badge
              variant="outline"
              className="h-4 px-1 font-mono text-3xs text-muted-foreground"
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
  col.accessor("outcome", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Outcome"
        hint="What happened to the run. Partial and refused runs are still ok; the rest are failure modes. A flag names the run limit that stopped it."
      />
    ),
    cell: ({ getValue, row }) => (
      <span className="flex items-center gap-1.5">
        <OutcomeBadge outcome={getValue()} />
        {row.original.boundHit && (
          <BoundHitFlag bound={row.original.boundHit} />
        )}
      </span>
    ),
    sortFn: (a, b) =>
      outcomeOrder.indexOf(a.original.outcome) -
      outcomeOrder.indexOf(b.original.outcome),
    meta: { width: "w-44", label: "Outcome", skeleton: "w-20 rounded-full" },
  }),
  col.accessor((r) => r.evals.grounded, {
    id: "grounded",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Grounded"
        hint="Evaluator score, 0 to 1: share of claims supported by the retrieved sources."
      />
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
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={formatMs} />
    ),
    meta: { width: "w-24", label: "Latency", numeric: true, skeleton: "w-12" },
  }),
  col.accessor((r) => r.tokensIn + r.tokensOut, {
    id: "tokens",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tokens" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={formatTokens} muted />
    ),
    meta: { width: "w-24", label: "Tokens", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("cost", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatCost(n, 3)} muted />
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
  col.accessor("version", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Version"
        hint="Agent build that served the run. Compare versions after a release."
      />
    ),
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {getValue()}
      </span>
    ),
    meta: { width: "w-24", label: "Version", skeleton: "w-12" },
  }),
  col.accessor("startedAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-32", label: "Started", skeleton: "w-20" },
  }),
])

const boundLabel: Record<BoundHit, string> = {
  max_steps: "Max steps",
  deadline: "Deadline",
  cost_budget: "Cost budget",
  no_progress: "No progress",
}
/** Only the bounds the generator actually produces, so no facet is empty. */
const boundOptions = [
  ...new Set(
    agentTraces.map((t) => t.boundHit).filter((b): b is BoundHit => Boolean(b))
  ),
].map((b) => ({ value: b, label: boundLabel[b] }))

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
    id: "outcome",
    title: "Outcome",
    options: outcomeOrder.map((v) => ({ value: v, label: outcomeLabel[v] })),
    getValue: (r) => r.outcome,
  },
  {
    id: "bound",
    title: "Bound hit",
    options: [...boundOptions, { value: "none", label: "None" }],
    getValue: (r) => r.boundHit ?? "none",
  },
  {
    id: "flag",
    title: "Flag",
    options: traceFlags.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.flags,
  },
  {
    id: "version",
    title: "Version",
    options: [...new Set(agentTraces.map((t) => t.version))]
      .sort()
      .map((v) => ({ value: v, label: v })),
    getValue: (r) => r.version,
  },
  {
    id: "promptVersion",
    title: "Prompt version",
    options: [...new Set(agentTraces.map((t) => t.lineage.promptVersion))]
      .sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)))
      .map((v) => ({ value: v, label: v })),
    getValue: (r) => r.lineage.promptVersion,
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
  initialFacets,
}: {
  data?: AgentTrace[]
  agentId?: string
  compact?: boolean
  /**
   * Facet selections from the URL, e.g. `{ status: ["Failed"] }` or
   * `{ promptVersion: ["p-41"] }` from `?version=p-41`.
   */
  initialFacets?: Record<string, string[]>
}) {
  const scoped = agentId ? data.filter((t) => t.agentId === agentId) : data
  return (
    <DataTable
      columns={traceColumns}
      data={scoped}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.id} ${r.userQuery} ${r.finalAnswer} ${r.sessionId} ${r.version} ${r.lineage.promptVersion} ${r.flags.join(" ")} ${outcomeLabel[r.outcome]}`
      }
      searchPlaceholder="Search traces, sessions, text…"
      facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
      initialFacets={initialFacets}
      initialSorting={[{ id: "startedAt", desc: true }]}
      initialColumnVisibility={{
        modelId: false,
        version: false,
        tokens: !compact,
        cost: !compact,
      }}
      rowHref={(r) => `/agentops/traces/${r.id}`}
      pageSize={compact ? 10 : 20}
      totalLabel="traces"
      caption="Agent traces"
      density={compact ? "compact" : undefined}
      selectionLabel={(n) => (n === 1 ? "trace" : "traces")}
      bulkActions={(rows, clear) => (
        <SendToReview traces={rows.map((r) => r.original)} onDone={clear} />
      )}
    />
  )
}

/** Bulk action: queues the selected traces in the shared review store. */
function SendToReview({
  traces,
  onDone,
}: {
  traces: AgentTrace[]
  onDone: () => void
}) {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const created = traces.filter(
          (t) => queueTraceForReview(t).created
        ).length
        const skipped = traces.length - created
        toast.success(
          created
            ? `${created} trace${created === 1 ? "" : "s"} added to the review queue`
            : "Already in the review queue",
          {
            description: skipped
              ? `${skipped} already had a queue item`
              : "Pending for the current session",
            action: {
              label: "Open queue",
              onClick: () => router.push("/agentops/reviews"),
            },
          }
        )
        onDone()
      }}
    >
      <ClipboardCheckIcon /> Send to review
    </Button>
  )
}
