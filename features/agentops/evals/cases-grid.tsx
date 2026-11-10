"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  FlagIcon,
  PlayIcon,
  RouteIcon,
  StarIcon,
} from "lucide-react"
import { toast } from "sonner"

import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  type DataTableFeatures,
} from "@/components/data-table"
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
import { getTrace } from "@/lib/data"
import { getEvaluator, type EvalCase, type EvalRun } from "@/lib/data/evals"
import {
  ChangeBadge,
  fmtCost,
  fmtMs,
  formatEvalScore,
  PassFailBadge,
  ScoreCell,
  scoreToneFor,
  shortName,
} from "./shared"

type Filter = "all" | "regressions" | "failures"

const col = createColumnHelper<DataTableFeatures, EvalCase>()

function buildColumns(evaluatorIds: string[]) {
  return col.columns([
    col.accessor("id", {
      header: "#",
      cell: ({ getValue }) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {getValue().split("-c")[1]}
        </span>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { width: "w-12", label: "Case", skeleton: "w-6" },
    }),
    col.accessor("input", {
      header: "Input",
      cell: ({ getValue }) => <Clamp text={getValue()} />,
      enableSorting: false,
      meta: { width: "min-w-56 max-w-xs", label: "Input", skeleton: "w-48" },
    }),
    col.accessor("expected", {
      header: "Expected",
      cell: ({ getValue }) => <Clamp text={getValue()} muted />,
      enableSorting: false,
      meta: {
        width: "min-w-56 max-w-xs",
        label: "Expected output",
        skeleton: "w-48",
      },
    }),
    col.accessor("actual", {
      header: "Actual",
      cell: ({ row }) => (
        <Clamp
          text={row.original.actual}
          muted={row.original.passed}
          danger={
            !row.original.passed &&
            row.original.actual !== row.original.expected
          }
        />
      ),
      enableSorting: false,
      meta: {
        width: "min-w-56 max-w-xs",
        label: "Actual output",
        skeleton: "w-48",
      },
    }),
    ...evaluatorIds.map((e) =>
      col.accessor((r) => r.scores[e] ?? -1, {
        id: e,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={shortName(getEvaluator(e)?.name ?? e)}
          />
        ),
        cell: ({ row }) => (
          <ScoreCell evaluatorId={e} value={row.original.scores[e]} />
        ),
        meta: {
          width: "w-24",
          label: getEvaluator(e)?.name ?? e,
          skeleton: "w-10 rounded-md",
        },
      })
    ),
    col.accessor("passed", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Result" />
      ),
      cell: ({ getValue }) => <PassFailBadge passed={getValue()} />,
      meta: { width: "w-20", label: "Result", skeleton: "w-12 rounded-full" },
    }),
    col.accessor("baselinePassed", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Baseline" />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">
          {getValue() ? "Pass" : "Fail"}
        </span>
      ),
      meta: { width: "w-20", label: "Baseline result", skeleton: "w-8" },
    }),
    col.accessor("change", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Changed" />
      ),
      cell: ({ getValue }) => <ChangeBadge change={getValue()} />,
      sortFn: (a, b) => rank[a.original.change] - rank[b.original.change],
      meta: { width: "w-28", label: "Changed", skeleton: "w-16 rounded-full" },
    }),
    col.accessor("latencyMs", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Latency" />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={fmtMs} muted />
      ),
      meta: {
        width: "w-20",
        label: "Latency",
        numeric: true,
        skeleton: "w-10",
      },
    }),
    col.accessor("cost", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cost" />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={(n) => fmtCost(n, 3)} muted />
      ),
      meta: { width: "w-20", label: "Cost", numeric: true, skeleton: "w-10" },
    }),
  ])
}

const rank: Record<EvalCase["change"], number> = {
  regression: 0,
  improvement: 1,
  same: 2,
}

function Clamp({
  text,
  muted,
  danger,
}: {
  text: string
  muted?: boolean
  danger?: boolean
}) {
  return (
    <span
      title={text}
      className={cn(
        "line-clamp-2 text-xs leading-snug",
        muted && "text-muted-foreground",
        danger && "text-danger-text"
      )}
    >
      {text}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Grid                                                                      */
/* ------------------------------------------------------------------------ */

export function CasesGrid({ run, cases }: { run: EvalRun; cases: EvalCase[] }) {
  const [filter, setFilter] = React.useState<Filter>(
    run.regressions > 0 ? "regressions" : run.failed > 0 ? "failures" : "all"
  )
  const [openId, setOpenId] = React.useState<string | null>(null)
  const columns = React.useMemo(
    () => buildColumns(run.evaluatorIds),
    [run.evaluatorIds]
  )
  const data = React.useMemo(
    () =>
      filter === "regressions"
        ? cases.filter((c) => c.change === "regression")
        : filter === "failures"
          ? cases.filter((c) => !c.passed)
          : cases,
    [cases, filter]
  )
  const open = cases.find((c) => c.id === openId) ?? null
  const hidden = Object.fromEntries(
    run.evaluatorIds.slice(5).map((e) => [e, false])
  )

  return (
    <>
      <DataTable
        key={filter}
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.input} ${r.expected} ${r.actual} ${r.tags.join(" ")}`
        }
        searchPlaceholder="Search inputs and outputs…"
        initialSorting={[{ id: "change", desc: false }]}
        initialColumnVisibility={{ latencyMs: false, cost: false, ...hidden }}
        onRowClick={(r) => setOpenId(r.id)}
        density="compact"
        pageSize={25}
        totalLabel="cases"
        selectionLabel={(n) => (n === 1 ? "case" : "cases")}
        emptyTitle={
          filter === "regressions"
            ? "No regressions"
            : filter === "failures"
              ? "No failures"
              : "No cases"
        }
        emptyMessage={
          filter === "regressions"
            ? "Every case that passed on the baseline still passes."
            : filter === "failures"
              ? "All cases passed every evaluator."
              : "This run has no test cases yet."
        }
        toolbar={
          <ToggleGroup
            value={[filter]}
            onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
            aria-label="Filter cases"
          >
            <ToggleGroupItem value="regressions" size="sm" className="text-xs">
              Regressions
              <Count n={run.regressions} tone="danger" />
            </ToggleGroupItem>
            <ToggleGroupItem value="failures" size="sm" className="text-xs">
              Failures
              <Count n={run.failed} />
            </ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm" className="text-xs">
              All
              <Count n={cases.length} />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <CaseSheet run={run} item={open} onClose={() => setOpenId(null)} />
    </>
  )
}

function Count({ n, tone }: { n: number; tone?: "danger" }) {
  return (
    <span
      className={cn(
        "ml-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
        tone === "danger" && n > 0
          ? "bg-destructive/10 text-danger-text"
          : "bg-muted text-muted-foreground"
      )}
    >
      {n}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Case sheet                                                                */
/* ------------------------------------------------------------------------ */

function CaseSheet({
  run,
  item: c,
  onClose,
}: {
  run: EvalRun
  item: EvalCase | null
  onClose: () => void
}) {
  const trace = c?.traceId ? getTrace(c.traceId) : undefined
  return (
    <Sheet open={c !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {c && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <PassFailBadge passed={c.passed} size="default" />
                <ChangeBadge change={c.change} size="default" />
                <span className="text-xs text-muted-foreground">
                  Baseline {c.baselinePassed ? "passed" : "failed"}
                </span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {t}
                    </Badge>
                  ))}
                </span>
              </div>
              <SheetTitle className="font-mono text-base leading-tight">
                {c.id}
              </SheetTitle>
              <SheetDescription className="text-xs tabular-nums">
                {fmtMs(c.latencyMs)} · {fmtCost(c.cost, 3)} per case ·{" "}
                {run.evaluatorIds.length} evaluators
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                <Block label="Input" text={c.input} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <Block label="Expected output" text={c.expected} />
                  <Block
                    label="Actual output"
                    text={c.actual}
                    tone={
                      c.passed
                        ? "default"
                        : c.actual !== c.expected
                          ? "danger"
                          : "default"
                    }
                  />
                </div>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Evaluator scores</h3>
                  <ul className="divide-y rounded-lg border">
                    {run.evaluatorIds.map((e) => {
                      const ev = getEvaluator(e)
                      const v = c.scores[e]
                      if (!ev || v === undefined) return null
                      const tone = scoreToneFor(v)
                      return (
                        <li key={e} className="flex gap-3 px-3 py-2.5">
                          <span
                            className={cn(
                              "mt-0.5 inline-flex h-6 w-14 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-medium tabular-nums",
                              tone === "success" &&
                                "bg-success/12 text-success-text",
                              tone === "warning" &&
                                "bg-warning/15 text-warning-text",
                              tone === "danger" &&
                                "bg-destructive/12 text-danger-text"
                            )}
                          >
                            {formatEvalScore(v, ev.scale)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="text-sm font-medium">
                                {ev.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {ev.type}
                                {ev.modelId
                                  ? ` · ${ev.modelId.split("/")[1]}`
                                  : ""}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {c.rationales[e]}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                {trace ? (
                  <section className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <RouteIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-medium">
                          {trace.id}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {trace.spans.length} spans · {fmtMs(trace.durationMs)}{" "}
                          · {trace.status}
                        </span>
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/agentops/traces/${trace.id}`} />}
                    >
                      Open trace <ArrowUpRightIcon />
                    </Button>
                  </section>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    No production trace is linked to this case — it was authored
                    or synthesised rather than sampled from traffic.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.warning("Case flagged", {
                    description: `${c.id} routed to the dataset owner for review`,
                  })
                }
              >
                <FlagIcon /> Flag case
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.success("Added to golden set", {
                    description: `${c.id} will ship in the next dataset version`,
                  })
                }
              >
                <StarIcon /> Add to golden set
              </Button>
              <Button
                size="sm"
                render={
                  <Link
                    href={`/agentops/playground?agent=${run.agentId}&prompt=${run.promptVersion}`}
                  />
                }
              >
                <PlayIcon /> Open in playground
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Block({
  label,
  text,
  tone = "default",
}: {
  label: string
  text: string
  tone?: "default" | "danger"
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      <pre
        className={cn(
          "rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap",
          tone === "danger" && "border-destructive/30 bg-destructive/5"
        )}
      >
        {text}
      </pre>
    </section>
  )
}

/* ------------------------------------------------------------------------ */
/* Distribution                                                              */
/* ------------------------------------------------------------------------ */

const bins = ["0–0.2", "0.2–0.4", "0.4–0.6", "0.6–0.8", "0.8–1.0"]

/** Score histogram per evaluator: one stacked column per bin. */
export function ScoreDistribution({
  run,
  cases,
}: {
  run: EvalRun
  cases: EvalCase[]
}) {
  const ids = run.evaluatorIds.filter(
    (e) => getEvaluator(e)?.scale !== "pass/fail"
  )
  const data = bins.map((name, b) => {
    const row: Record<string, string | number> = { name }
    for (const e of ids) {
      row[e] = cases.filter((c) => {
        const v = c.scores[e]
        if (v === undefined) return false
        const idx = Math.min(4, Math.floor(v * 5))
        return idx === b
      }).length
    }
    return row
  })
  const series = ids.map((e, i) => ({
    key: e,
    label: shortName(getEvaluator(e)?.name ?? e),
    color: `var(--chart-${(i % 5) + 1})`,
  }))
  return (
    <StackedBarChart
      data={data}
      series={series}
      height={220}
      valueFormatter={(v) => `${v} ${v === 1 ? "case" : "cases"}`}
    />
  )
}
