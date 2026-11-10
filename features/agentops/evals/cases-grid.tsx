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

import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  type DataTableFeatures,
} from "@/components/data-table"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
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
import { getTrace } from "@/lib/data/agentops"
import {
  getDataset,
  getEvaluator,
  type EvalCase,
  type EvalRun,
} from "@/lib/data/evals"
import { formatCost, formatMs } from "@/lib/format"
import {
  ChangeBadge,
  formatEvalScore,
  PassFailBadge,
  ScoreCell,
  scoreToneFor,
  shortName,
} from "./shared"
import { addCasesToDataset } from "./store"

type Filter = "all" | "regressions" | "failures"

const col = createColumnHelper<DataTableFeatures, EvalCase>()

function buildColumns(evaluatorIds: string[], flagged: Set<string>) {
  return col.columns([
    col.accessor("id", {
      header: "#",
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
          {getValue().split("-c")[1]}
          {flagged.has(getValue()) && (
            <FlagIcon
              className="size-3 text-warning-text"
              aria-label="Flagged in this session"
            />
          )}
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
        header: ({ column }) => {
          const ev = getEvaluator(e)
          return (
            <DataTableColumnHeader
              column={column}
              title={shortName(ev?.name ?? e)}
              hint={
                ev
                  ? `${ev.name}: ${ev.measures}, scored ${ev.scale}`
                  : undefined
              }
            />
          )
        },
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
        <DataTableColumnHeader
          column={column}
          title="Baseline"
          hint="Result of the same case on the baseline run."
        />
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
        <DataTableColumnHeader
          column={column}
          title="Changed"
          hint="Regression: passed on the baseline, fails now. Improvement: the reverse."
        />
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
        <NumericCell value={getValue()} format={formatMs} muted />
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
        <NumericCell
          value={getValue()}
          format={(n) => formatCost(n, 3)}
          muted
        />
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
  const [flagged, setFlagged] = React.useState<Set<string>>(() => new Set())
  const [golden, setGolden] = React.useState<Set<string>>(() => new Set())
  const columns = React.useMemo(
    () => buildColumns(run.evaluatorIds, flagged),
    [run.evaluatorIds, flagged]
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
        caption={`Test cases for ${run.id} with expected and actual output and every evaluator score`}
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
              <CountPill
                count={run.regressions}
                tone={run.regressions > 0 ? "danger" : "muted"}
                className="ml-1"
              />
            </ToggleGroupItem>
            <ToggleGroupItem value="failures" size="sm" className="text-xs">
              Failures
              <CountPill count={run.failed} className="ml-1" />
            </ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm" className="text-xs">
              All
              <CountPill count={cases.length} className="ml-1" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <CaseSheet
        run={run}
        item={open}
        flagged={open ? flagged.has(open.id) : false}
        inGolden={open ? golden.has(open.id) : false}
        onFlag={(id) => setFlagged((s) => new Set(s).add(id))}
        onGolden={(id) => setGolden((s) => new Set(s).add(id))}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Case sheet                                                                */
/* ------------------------------------------------------------------------ */

function CaseSheet({
  run,
  item: c,
  flagged,
  inGolden,
  onFlag,
  onGolden,
  onClose,
}: {
  run: EvalRun
  item: EvalCase | null
  flagged: boolean
  inGolden: boolean
  onFlag: (id: string) => void
  onGolden: (id: string) => void
  onClose: () => void
}) {
  const trace = c?.traceId ? getTrace(c.traceId) : undefined
  const dataset = getDataset(run.datasetId)

  function flag() {
    if (!c) return
    onFlag(c.id)
    toast.warning("Case flagged", {
      description: `${c.id} is marked in this session's grid. Flags are not sent anywhere in the template.`,
    })
  }

  function addToGolden() {
    if (!c) return
    const updated = addCasesToDataset(
      run.datasetId,
      1,
      `${c.id} promoted from ${run.id}`
    )
    onGolden(c.id)
    toast.success(`Added to ${dataset?.name ?? run.datasetId}`, {
      description: updated
        ? `${updated.version} drafted in this session, now ${updated.cases} cases.`
        : undefined,
    })
  }

  return (
    <Sheet open={c !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {c && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <PassFailBadge passed={c.passed} size="default" />
                <ChangeBadge change={c.change} size="default" />
                {flagged && (
                  <StateBadge state="Flagged" tone="warning" size="sm" />
                )}
                {inGolden && <StateBadge state="In golden set" size="sm" />}
                <span className="text-xs text-muted-foreground">
                  Baseline {c.baselinePassed ? "passed" : "failed"}
                </span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="h-5 px-1.5 font-mono text-3xs text-muted-foreground"
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
                {formatMs(c.latencyMs)} · {formatCost(c.cost, 3)} per case ·{" "}
                {run.evaluatorIds.length} evaluators
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
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
                              "mt-0.5 inline-flex h-6 w-14 shrink-0 items-center justify-center rounded-md font-mono text-2xs font-medium tabular-nums",
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
                              <span className="text-2xs text-muted-foreground">
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
                          {trace.spans.length} spans ·{" "}
                          {formatMs(trace.durationMs)} · {trace.status}
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
                  <EmptyState
                    size="sm"
                    bare
                    icon={<RouteIcon />}
                    title="No production trace"
                    description="This case was authored or synthesised rather than sampled from traffic."
                  />
                )}
              </div>
            </SheetBody>

            <SheetFooterActions
              tertiary={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={flagged}
                  onClick={flag}
                >
                  <FlagIcon /> {flagged ? "Flagged" : "Flag case"}
                </Button>
              }
              secondary={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inGolden}
                  onClick={addToGolden}
                >
                  <StarIcon />{" "}
                  {inGolden ? "In golden set" : "Add to golden set"}
                </Button>
              }
              primary={
                <Button
                  size="sm"
                  render={
                    <Link
                      href={`/agentops/playground?agent=${run.agentId}&pv=${run.promptVersion}`}
                    />
                  }
                >
                  <PlayIcon /> Open in playground
                </Button>
              }
            />
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
      <Eyebrow as="h3">{label}</Eyebrow>
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

const bins = ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"]

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
    color: `var(--chart-${(i % 8) + 1})`,
  }))
  return (
    <StackedBarChart
      data={data}
      series={series}
      height={CHART_HEIGHT.md}
      valueFormatter={(v) => `${v} ${v === 1 ? "case" : "cases"}`}
    />
  )
}
