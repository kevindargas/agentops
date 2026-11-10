"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  CheckIcon,
  FlaskConicalIcon,
  OctagonXIcon,
  PlayIcon,
  TrophyIcon,
} from "lucide-react"
import { toast } from "sonner"

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
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
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
  deployedAgents,
  experiments as seed,
  getDeployedAgent,
} from "@/lib/data"
import { formatNumber } from "@/lib/format"
import type { Experiment, ExperimentVariant } from "@/lib/types"
import { AgentChip, fmtMs, ModelChip } from "./shared"

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

function primary(v: ExperimentVariant, m: Experiment["primaryMetric"]) {
  return m === "quality" ? v.quality : m === "cost" ? v.costPer1k : v.p95Ms
}
function fmtPrimary(n: number, m: Experiment["primaryMetric"]) {
  return m === "quality"
    ? n.toFixed(1)
    : m === "cost"
      ? `$${n.toFixed(1)}`
      : fmtMs(n)
}
/** Whether B improves on A for this metric (higher quality, lower cost/latency). */
function bWins(e: Experiment) {
  const [a, b] = e.variants
  const pa = primary(a, e.primaryMetric),
    pb = primary(b, e.primaryMetric)
  return e.primaryMetric === "quality" ? pb > pa : pb < pa
}

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
      <DataTableColumnHeader column={column} title="Split" />
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="A" />,
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="B" />,
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
      <DataTableColumnHeader column={column} title="P(B > A)" />
    ),
    cell: ({ getValue, row }) => {
      const v = getValue()
      if (!v) return <NumericCell value={null} />
      return (
        <NumericCell
          value={v}
          format={(n) => `${Math.round(n * 100)}%`}
          className={cn(
            v >= 0.95 &&
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

const facets: FacetDef<Experiment>[] = [
  {
    id: "status",
    title: "Status",
    options: ["Draft", "Running", "Completed", "Promoted", "Stopped"].map(
      (v) => ({ value: v, label: v })
    ),
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

export function ExperimentsTable({
  agentId,
  initialOpenId,
}: {
  agentId?: string
  initialOpenId?: string
}) {
  const [items, setItems] = React.useState<Experiment[]>(seed)
  const [openId, setOpenId] = React.useState<string | null>(
    initialOpenId ?? null
  )
  const data = agentId ? items.filter((e) => e.agentId === agentId) : items
  const open = items.find((e) => e.id === openId) ?? null

  const patch = (id: string, p: Partial<Experiment>) =>
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e)))

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
        initialSorting={[{ id: "started", desc: true }]}
        initialColumnVisibility={{ ownerId: false, requests: false }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="experiments"
        selectionLabel={(n) => (n === 1 ? "experiment" : "experiments")}
        toolbar={
          <Button
            size="sm"
            onClick={() => toast("New experiment wizard opened")}
          >
            <FlaskConicalIcon /> New experiment
          </Button>
        }
      />
      <ExperimentSheet
        experiment={open}
        onClose={() => setOpenId(null)}
        onPatch={patch}
      />
    </>
  )
}

export function ExperimentSheet({
  experiment: e,
  onClose,
  onPatch,
}: {
  experiment: Experiment | null
  onClose: () => void
  onPatch: (id: string, p: Partial<Experiment>) => void
}) {
  return (
    <Sheet open={e !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                <Verdict e={e} />

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Variants</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[32rem] text-sm">
                      <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
                                    "inline-flex size-4 items-center justify-center rounded-sm font-mono text-[10px] text-background",
                                    v.key === "A" ? "bg-chart-5" : "bg-chart-1"
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
                              <td key={v.key} className="px-3 py-2 text-right">
                                {v.modelId ? (
                                  <ModelChip
                                    modelId={v.modelId}
                                    className="justify-end text-xs"
                                  />
                                ) : (
                                  "—"
                                )}
                              </td>
                            ))}
                          </tr>
                        )}
                        <Row
                          label="Requests"
                          vals={e.variants.map((v) => formatNumber(v.requests))}
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
                          vals={e.variants.map((v) => fmtMs(v.p95Ms))}
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
                      height={200}
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
                      v[0] && onPatch(e.id, { split: Number(v[0]) })
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
                  <Fact label="Owner">
                    <UserChip userId={e.ownerId} size="xs" />
                  </Fact>
                  <Fact label="Started">
                    <DateCell
                      value={e.started}
                      mode="absolute"
                      tone="default"
                    />
                  </Fact>
                  <Fact label={e.status === "Running" ? "Ends" : "Ended"}>
                    {e.ends ? (
                      <DateCell value={e.ends} mode="absolute" tone="default" />
                    ) : (
                      "—"
                    )}
                  </Fact>
                </section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              {e.status === "Draft" && (
                <Button
                  size="sm"
                  onClick={() => {
                    onPatch(e.id, { status: "Running" })
                    toast.success("Experiment started", {
                      description: `${e.split}% of traffic now routes to variant B`,
                    })
                  }}
                >
                  <PlayIcon /> Start
                </Button>
              )}
              {e.status === "Running" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onPatch(e.id, {
                        status: "Stopped",
                        winner: bWins(e) ? undefined : "A",
                      })
                      toast("Experiment stopped", {
                        description: "All traffic returned to the control",
                      })
                    }}
                  >
                    <OctagonXIcon /> Stop
                  </Button>
                  <Button
                    size="sm"
                    disabled={e.significance < 0.95 || !bWins(e)}
                    onClick={() => {
                      onPatch(e.id, {
                        status: "Promoted",
                        winner: "B",
                        split: 100,
                      })
                      toast.success("Variant B promoted", {
                        description: `${getDeployedAgent(e.agentId)?.name} now serves 100% on the new configuration`,
                      })
                    }}
                  >
                    <TrophyIcon /> Promote B
                  </Button>
                </>
              )}
              {e.status === "Completed" && e.winner === "B" && (
                <Button
                  size="sm"
                  onClick={() => {
                    onPatch(e.id, { status: "Promoted", split: 100 })
                    toast.success("Variant B promoted")
                  }}
                >
                  <CheckIcon /> Promote winner
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Verdict({ e }: { e: Experiment }) {
  if (e.status === "Draft")
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        Not started. Variant B has no traffic yet.
      </p>
    )
  const wins = bWins(e)
  const sig = Math.round(e.significance * 100)
  const tone =
    e.significance >= 0.95 ? (wins ? "success" : "danger") : "warning"
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
          {e.significance >= 0.95
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
          {e.significance < 0.95 &&
            e.status === "Running" &&
            " · keep running until 95%"}
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
        <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
          95% threshold
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

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
