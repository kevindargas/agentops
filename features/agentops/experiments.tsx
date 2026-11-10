"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  CheckIcon,
  FlaskConicalIcon,
  LightbulbIcon,
  OctagonXIcon,
  PlayIcon,
  TrophyIcon,
} from "lucide-react"
import { toast } from "sonner"

import { setQueryParam } from "@/hooks/use-query-param"
import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  SIGNIFICANCE_THRESHOLD,
  deployedAgents,
  experiments as seed,
  getDeployedAgent,
} from "@/lib/data/agentops"
import { getPromptForAgent } from "@/lib/data/prompts"
import { formatMs, formatNumber } from "@/lib/format"
import type { Experiment, ExperimentVariant } from "@/lib/types"
import { AgentChip, ModelChip } from "./shared"
import { experimentStore, recommendationStore } from "./stores"

const col = createColumnHelper<DataTableFeatures, Experiment>()
const kindLabel: Record<Experiment["kind"], string> = {
  model: "Model",
  prompt: "Prompt",
  retrieval: "Retrieval",
  tooling: "Tooling",
}
const metricLabel: Record<Experiment["primaryMetric"], string> = {
  quality: "Quality",
  cost: "Cost / 1K",
  latency: "p95 latency",
}
/** Decision threshold for P(B > A), used everywhere in the UI. */

function primary(v: ExperimentVariant, m: Experiment["primaryMetric"]) {
  return m === "quality" ? v.quality : m === "cost" ? v.costPer1k : v.p95Ms
}
function fmtPrimary(n: number, m: Experiment["primaryMetric"]) {
  return m === "quality"
    ? n.toFixed(1)
    : m === "cost"
      ? `$${n.toFixed(1)}`
      : formatMs(n)
}
/** Whether B improves on A for this metric (higher quality, lower cost/latency). */
function bWins(e: Experiment) {
  const [a, b] = e.variants
  const pa = primary(a, e.primaryMetric),
    pb = primary(b, e.primaryMetric)
  return e.primaryMetric === "quality" ? pb > pa : pb < pa
}
const isDecided = (e: Experiment) =>
  e.status === "Completed" || e.status === "Promoted" || e.status === "Stopped"

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Experiment" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={row.original.name}
        secondary={`${kindLabel[row.original.kind]} · ${getDeployedAgent(row.original.agentId)?.name}`}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-72 max-w-md", label: "Experiment", skeleton: "w-56" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-28", label: "Status", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("split", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Split"
        hint="Share of sessions routed to control A and variant B."
      />
    ),
    cell: ({ getValue }) => (
      <span className="flex items-center gap-2">
        <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <span
            className="h-full bg-chart-5"
            style={{ width: `${100 - getValue()}%` }}
          />
          <span
            className="h-full bg-chart-1"
            style={{ width: `${getValue()}%` }}
          />
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {100 - getValue()}/{getValue()}
        </span>
      </span>
    ),
    meta: { width: "w-36", label: "Traffic split", skeleton: "w-20" },
  }),
  col.accessor((r) => primary(r.variants[0], r.primaryMetric), {
    id: "a",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="A"
        hint="Control: the configuration currently deployed, measured on the primary metric."
      />
    ),
    cell: ({ row }) => (
      <NumericCell
        value={
          primary(row.original.variants[0], row.original.primaryMetric) || null
        }
        format={(n) => fmtPrimary(n, row.original.primaryMetric)}
        muted
      />
    ),
    meta: { width: "w-24", label: "Control", numeric: true, skeleton: "w-10" },
  }),
  col.accessor((r) => primary(r.variants[1], r.primaryMetric), {
    id: "b",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="B"
        hint="Variant under test on the primary metric. Green when it beats control, red when it loses."
      />
    ),
    cell: ({ row }) => {
      const v = primary(row.original.variants[1], row.original.primaryMetric)
      if (!v) return <NumericCell value={null} />
      return (
        <NumericCell
          value={v}
          format={(n) => fmtPrimary(n, row.original.primaryMetric)}
          className={
            bWins(row.original) ? "text-success-text" : "text-danger-text"
          }
        />
      )
    },
    meta: { width: "w-24", label: "Variant", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("primaryMetric", {
    header: "Metric",
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {metricLabel[getValue()]}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-24", label: "Primary metric", skeleton: "w-12" },
  }),
  col.accessor("significance", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="P(B > A)"
        hint={`Probability that variant B beats control on the primary metric. ${Math.round(SIGNIFICANCE_THRESHOLD * 100)}% is the promotion threshold.`}
      />
    ),
    cell: ({ getValue, row }) => {
      const v = getValue()
      if (!v) return <NumericCell value={null} />
      return (
        <NumericCell
          value={v}
          format={(n) => `${Math.round(n * 100)}%`}
          className={cn(
            v >= SIGNIFICANCE_THRESHOLD &&
              (bWins(row.original) ? "text-success-text" : "text-danger-text")
          )}
        />
      )
    },
    meta: {
      width: "w-24",
      label: "Significance",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor((r) => r.variants[0].requests + r.variants[1].requests, {
    id: "requests",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Requests" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue() || null}
        format={(n) => formatNumber(n, true)}
        muted
      />
    ),
    meta: { width: "w-24", label: "Requests", numeric: true, skeleton: "w-12" },
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
  col.accessor("started", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Started", skeleton: "w-16" },
  }),
])

const statusOrder: Experiment["status"][] = [
  "Draft",
  "Running",
  "Completed",
  "Promoted",
  "Stopped",
]
const facets: FacetDef<Experiment>[] = [
  {
    id: "status",
    title: "Status",
    // Only statuses the seed produces, so no facet option is permanently empty.
    options: statusOrder
      .filter((s) => seed.some((e) => e.status === s))
      .map((v) => ({ value: v, label: v })),
    getValue: (r) => r.status,
  },
  {
    id: "kind",
    title: "Kind",
    options: (Object.keys(kindLabel) as Experiment["kind"][]).map((k) => ({
      value: k,
      label: kindLabel[k],
    })),
    getValue: (r) => r.kind,
  },
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
]

/** Stat row for the Experiments page; reads the same store as the table. */
export function ExperimentStats() {
  const items = experimentStore.use()
  const running = items.filter((e) => e.status === "Running")
  const decided = items.filter(isDecided)
  return (
    <StatGrid columns={3}>
      <StatCard
        label="Running"
        value={running.length}
        hint={`${running.filter((e) => e.significance >= SIGNIFICANCE_THRESHOLD).length} ready to decide`}
      />
      <StatCard
        label="Decided"
        value={decided.length}
        hint={`${items.filter((e) => e.winner === "B").length} variants won`}
      />
      <StatCard
        label="Drafts"
        value={items.filter((e) => e.status === "Draft").length}
        hint="Created from drift signals and recommendations"
      />
    </StatGrid>
  )
}

export function ExperimentsTable({
  agentId,
  initialOpenId,
  initialAgentFacet,
  syncUrl = false,
}: {
  /** Embed scoped to one agent (agent record tab). */
  agentId?: string
  /** `?open=<exp-id>` */
  initialOpenId?: string
  /** `?agent=<agt-id>` preselects the Agent facet on the list page. */
  initialAgentFacet?: string
  /** Mirror the open sheet into `?open=` (list page only). */
  syncUrl?: boolean
}) {
  const items = experimentStore.use()
  const [openId, setOpenId] = React.useState<string | null>(
    initialOpenId ?? null
  )
  const data = agentId ? items.filter((e) => e.agentId === agentId) : items
  const open = items.find((e) => e.id === openId) ?? null

  const setOpen = (id: string | null) => {
    setOpenId(id)
    if (syncUrl) setQueryParam("open", id)
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.hypothesis} ${r.kind} ${getDeployedAgent(r.agentId)?.name ?? ""}`
        }
        searchPlaceholder="Search experiments…"
        facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
        initialFacets={
          initialAgentFacet && !agentId
            ? { agent: [initialAgentFacet] }
            : undefined
        }
        initialSorting={[{ id: "started", desc: true }]}
        initialColumnVisibility={{ ownerId: false, requests: false }}
        onRowClick={(r) => setOpen(r.id)}
        totalLabel="experiments"
        caption="A/B experiments"
        selectionLabel={(n) => (n === 1 ? "experiment" : "experiments")}
        toolbar={
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button size="sm" disabled>
                <FlaskConicalIcon /> New experiment
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              Experiments start from a drift signal (Start experiment) or a
              recommendation (Start A/B test), which prefill the agent and the
              hypothesis.
            </TooltipContent>
          </Tooltip>
        }
      />
      <ExperimentSheet experiment={open} onClose={() => setOpen(null)} />
    </>
  )
}

type Decision = "promote" | "stop"

export function ExperimentSheet({
  experiment: e,
  onClose,
}: {
  experiment: Experiment | null
  onClose: () => void
}) {
  const [decision, setDecision] = React.useState<Decision | null>(null)
  const patch = (id: string, p: Partial<Experiment>) =>
    experimentStore.patch(id, p)
  const recommendation = e
    ? recommendationStore.get().find((r) => r.experimentId === e.id)
    : undefined
  const agent = e ? getDeployedAgent(e.agentId) : undefined
  const prompt = e ? getPromptForAgent(e.agentId) : undefined
  const finishHref = e
    ? e.kind === "prompt"
      ? prompt
        ? `/agentops/prompts/${prompt.id}`
        : "/agentops/prompts"
      : e.kind === "model"
        ? `/agentops/deployments?agent=${e.agentId}`
        : e.kind === "retrieval"
          ? "/agentops/knowledge?tab=bases"
          : "/agentops/tools?tab=permissions"
    : "#"
  const finishLabel = e
    ? {
        prompt: "Finish on Prompts",
        model: "Finish on Deployments",
        retrieval: "Finish on Knowledge",
        tooling: "Finish on Tools",
      }[e.kind]
    : ""

  const start = () => {
    if (!e) return
    patch(e.id, { status: "Running" })
    toast.success("Experiment started", {
      description: `${e.split}% of traffic now routes to variant B`,
    })
  }
  const confirmDecision = () => {
    if (!e || !decision) return
    const previous = e
    if (decision === "stop") {
      patch(e.id, { status: "Stopped", winner: bWins(e) ? undefined : "A" })
      toast("Experiment stopped", {
        description: `All traffic returned to the control; ${e.split}% was on variant B`,
        action: {
          label: "Undo",
          onClick: () =>
            experimentStore.set((prev) =>
              prev.map((x) => (x.id === previous.id ? previous : x))
            ),
        },
        duration: 6000,
      })
    } else {
      patch(e.id, { status: "Promoted", winner: "B", split: 100 })
      toast.success("Variant B promoted", {
        description: `${agent?.name ?? e.agentId} is marked as serving 100% on variant B for this session. ${finishLabel} to ship the change.`,
      })
    }
    setDecision(null)
  }

  const canPromote =
    e &&
    ((e.status === "Running" &&
      e.significance >= SIGNIFICANCE_THRESHOLD &&
      bWins(e)) ||
      (e.status === "Completed" && e.winner === "B"))

  return (
    <>
      <Sheet open={e !== null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
        >
          {e && (
            <>
              <SheetHeader className="gap-3 border-b px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={e.status} />
                  <Badge variant="outline" className="text-muted-foreground">
                    {kindLabel[e.kind]}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    Primary: {metricLabel[e.primaryMetric]}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    <AgentChip agentId={e.agentId} size="sm" />
                  </span>
                </div>
                <SheetTitle className="text-lg leading-tight">
                  {e.name}
                </SheetTitle>
                <SheetDescription className="text-sm leading-relaxed">
                  {e.hypothesis}
                </SheetDescription>
              </SheetHeader>

              <SheetBody>
                <div className="flex flex-col gap-6">
                  <Verdict e={e} />

                  {recommendation && (
                    <Link
                      href={`/agentops/recommendations?open=${recommendation.id}`}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted"
                    >
                      <LightbulbIcon className="size-4 shrink-0 text-warning-text" />
                      <span className="min-w-0 flex-1 truncate">
                        Tests recommendation: {recommendation.title}
                      </span>
                      <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  )}

                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Variants</h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[32rem] text-sm">
                        <caption className="sr-only">
                          Variant metrics side by side
                        </caption>
                        <thead className="bg-muted/40 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">
                              Metric
                            </th>
                            {e.variants.map((v) => (
                              <th
                                key={v.key}
                                className="px-3 py-2 text-right font-medium"
                              >
                                <span className="inline-flex items-center gap-1.5 tracking-normal normal-case">
                                  <span
                                    className={cn(
                                      "inline-flex size-4 items-center justify-center rounded-sm font-mono text-3xs text-background",
                                      v.key === "A"
                                        ? "bg-chart-5"
                                        : "bg-chart-1"
                                    )}
                                  >
                                    {v.key}
                                  </span>
                                  {v.label.replace(/^(Control|Variant) · /, "")}
                                  {e.winner === v.key && (
                                    <TrophyIcon
                                      className="size-3.5 text-warning"
                                      aria-label="winner"
                                    />
                                  )}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {e.variants[0].modelId && (
                            <tr>
                              <td className="px-3 py-2 text-muted-foreground">
                                Model
                              </td>
                              {e.variants.map((v) => (
                                <td
                                  key={v.key}
                                  className="px-3 py-2 text-right"
                                >
                                  {v.modelId ? (
                                    <ModelChip
                                      modelId={v.modelId}
                                      className="justify-end text-xs"
                                    />
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Same as A
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          )}
                          <Row
                            label="Requests"
                            vals={e.variants.map((v) =>
                              formatNumber(v.requests)
                            )}
                          />
                          <Row
                            label="Quality score"
                            vals={e.variants.map((v) => v.quality.toFixed(1))}
                            better={
                              e.variants[1].quality > e.variants[0].quality
                                ? "B"
                                : "A"
                            }
                          />
                          <Row
                            label="Thumbs up"
                            vals={e.variants.map((v) => `${v.thumbsUp}%`)}
                            better={
                              e.variants[1].thumbsUp > e.variants[0].thumbsUp
                                ? "B"
                                : "A"
                            }
                          />
                          <Row
                            label="p95 latency"
                            vals={e.variants.map((v) => formatMs(v.p95Ms))}
                            better={
                              e.variants[1].p95Ms &&
                              e.variants[1].p95Ms < e.variants[0].p95Ms
                                ? "B"
                                : "A"
                            }
                          />
                          <Row
                            label="Cost / 1K requests"
                            vals={e.variants.map(
                              (v) => `$${v.costPer1k.toFixed(1)}`
                            )}
                            better={
                              e.variants[1].costPer1k &&
                              e.variants[1].costPer1k < e.variants[0].costPer1k
                                ? "B"
                                : "A"
                            }
                          />
                          <Row
                            label="Error rate"
                            vals={e.variants.map(
                              (v) => `${v.errorRate.toFixed(1)}%`
                            )}
                            better={
                              e.variants[1].errorRate < e.variants[0].errorRate
                                ? "B"
                                : "A"
                            }
                          />
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {e.daily.length > 0 && (
                    <section className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold">
                        {metricLabel[e.primaryMetric]} by day
                      </h3>
                      <IncidentTrendChart
                        data={e.daily}
                        series={[
                          {
                            key: "A",
                            label: e.variants[0].label,
                            color: "var(--chart-5)",
                          },
                          {
                            key: "B",
                            label: e.variants[1].label,
                            color: "var(--chart-1)",
                          },
                        ]}
                        height={CHART_HEIGHT.sm}
                        valueFormatter={(v) => fmtPrimary(v, e.primaryMetric)}
                      />
                    </section>
                  )}

                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">
                      Traffic to variant B
                    </h3>
                    <ToggleGroup
                      value={[String(e.split)]}
                      onValueChange={(v) =>
                        v[0] && patch(e.id, { split: Number(v[0]) })
                      }
                      disabled={e.status !== "Running" && e.status !== "Draft"}
                      aria-label="Traffic split"
                    >
                      {[5, 10, 20, 30, 50].map((n) => (
                        <ToggleGroupItem
                          key={n}
                          value={String(n)}
                          size="sm"
                          className="text-xs tabular-nums"
                        >
                          {n}%
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <p className="text-xs text-muted-foreground">
                      Ramp gradually. Traffic is assigned per session so a user
                      never sees both variants.
                    </p>
                  </section>

                  <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <MetricTile
                      label="Owner"
                      value={<UserChip userId={e.ownerId} size="xs" />}
                    />
                    <MetricTile
                      label="Started"
                      value={
                        <DateCell
                          value={e.started}
                          mode="absolute"
                          tone="default"
                        />
                      }
                    />
                    <MetricTile
                      label={e.status === "Running" ? "Ends" : "Ended"}
                      value={
                        e.ends ? (
                          <DateCell
                            value={e.ends}
                            mode="absolute"
                            tone="default"
                          />
                        ) : (
                          <span className="text-muted-foreground">Open</span>
                        )
                      }
                    />
                  </section>
                </div>
              </SheetBody>

              <SheetFooterActions
                tertiary={
                  e.status === "Promoted" || e.status === "Completed" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={finishHref} />}
                    >
                      {finishLabel} <ArrowUpRightIcon />
                    </Button>
                  ) : undefined
                }
                secondary={
                  e.status === "Running" ? (
                    <Button
                      variant="outline"
                      onClick={() => setDecision("stop")}
                    >
                      <OctagonXIcon /> Stop
                    </Button>
                  ) : undefined
                }
                primary={
                  e.status === "Draft" ? (
                    <Button onClick={start}>
                      <PlayIcon /> Start
                    </Button>
                  ) : e.status === "Running" ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="inline-flex" />}>
                        <Button
                          disabled={!canPromote}
                          onClick={() => setDecision("promote")}
                        >
                          <TrophyIcon /> Promote B
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">
                        {canPromote
                          ? "Opens a confirmation with the evidence"
                          : `Needs P(B > A) at ${Math.round(SIGNIFICANCE_THRESHOLD * 100)}% or above with B ahead on ${metricLabel[e.primaryMetric].toLowerCase()}`}
                      </TooltipContent>
                    </Tooltip>
                  ) : e.status === "Completed" && e.winner === "B" ? (
                    <Button onClick={() => setDecision("promote")}>
                      <CheckIcon /> Promote winner
                    </Button>
                  ) : undefined
                }
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={decision !== null}
        onOpenChange={(o) => !o && setDecision(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "stop"
                ? "Stop the experiment?"
                : "Promote variant B?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {e && decision === "stop"
                ? `${e.split}% of ${agent?.name ?? "the agent"}'s traffic returns to the control immediately. ${bWins(e) ? "B is currently ahead; the winner stays undecided." : "A is recorded as the winner."}`
                : e
                  ? `${Math.round(e.significance * 100)}% probability that B beats A on ${metricLabel[e.primaryMetric].toLowerCase()} (${fmtPrimary(primary(e.variants[0], e.primaryMetric), e.primaryMetric)} to ${fmtPrimary(primary(e.variants[1], e.primaryMetric), e.primaryMetric)}) over ${formatNumber(e.variants[0].requests + e.variants[1].requests)} requests. Check the eval gate on Evals & Datasets before shipping; promotion here records the decision and routes 100% to B for this session.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={decision === "stop" ? "destructive" : "default"}
              onClick={confirmDecision}
            >
              {decision === "stop" ? "Stop experiment" : "Promote B"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Verdict({ e }: { e: Experiment }) {
  if (e.status === "Draft")
    return (
      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        Not started. Variant B has no traffic yet; press Start to route{" "}
        {e.split}% of sessions to it.
      </p>
    )
  const wins = bWins(e)
  const sig = Math.round(e.significance * 100)
  const tone =
    e.significance >= SIGNIFICANCE_THRESHOLD
      ? wins
        ? "success"
        : "danger"
      : "warning"
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        tone === "success" && "border-success/30 bg-success/5",
        tone === "danger" && "border-destructive/30 bg-destructive/5",
        tone === "warning" && "border-warning/40 bg-warning/5"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {e.significance >= SIGNIFICANCE_THRESHOLD
            ? wins
              ? "Variant B is better with high confidence."
              : "Variant B is worse with high confidence."
            : "Not enough evidence yet."}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {sig}% probability that B beats A on{" "}
          {metricLabel[e.primaryMetric].toLowerCase()} ·{" "}
          {formatNumber(e.variants[0].requests + e.variants[1].requests)}{" "}
          requests observed
          {e.significance < SIGNIFICANCE_THRESHOLD &&
            e.status === "Running" &&
            ` · keep running until ${Math.round(SIGNIFICANCE_THRESHOLD * 100)}%`}
        </p>
      </div>
      <div className="w-28 shrink-0">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              tone === "success"
                ? "bg-success"
                : tone === "danger"
                  ? "bg-destructive"
                  : "bg-warning"
            )}
            style={{ width: `${sig}%` }}
          />
        </div>
        <p className="mt-1 text-right font-mono text-3xs text-muted-foreground tabular-nums">
          {Math.round(SIGNIFICANCE_THRESHOLD * 100)}% threshold
        </p>
      </div>
    </div>
  )
}

function Row({
  label,
  vals,
  better,
}: {
  label: string
  vals: string[]
  better?: "A" | "B"
}) {
  return (
    <tr>
      <td className="px-3 py-2 text-muted-foreground">{label}</td>
      {vals.map((v, i) => {
        const key = i === 0 ? "A" : "B"
        return (
          <td
            key={key}
            className={cn(
              "px-3 py-2 text-right font-medium tabular-nums",
              better === key && vals[0] !== vals[1] && "text-success-text"
            )}
          >
            {v}
          </td>
        )
      })}
    </tr>
  )
}
