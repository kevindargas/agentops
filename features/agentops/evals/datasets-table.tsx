"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  DatabaseIcon,
  DownloadIcon,
  ListPlusIcon,
  PlayIcon,
} from "lucide-react"
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
import { CountPill } from "@/components/shared/count-pill"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
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
import {
  deployedAgents,
  getDeployedAgent,
  reviewItems,
} from "@/lib/data/agentops"
import {
  evalRuns,
  getEvalCases,
  getEvaluator,
  type DatasetSource,
  type EvalDataset,
} from "@/lib/data/evals"
import { AgentChip } from "@/features/agentops/shared"
import { formatNumber } from "@/lib/format"
import { downloadText } from "../audit/export"
import { NotInDemoButton, PassFailBadge, RunStatusBadge } from "./shared"
import { addCasesToDataset, bumpVersion, datasetStore } from "./store"

const col = createColumnHelper<DataTableFeatures, EvalDataset>()
const sources: DatasetSource[] = [
  "Production traces",
  "Human-authored",
  "Synthetic",
  "Review corrections",
]
const sourceShort: Record<DatasetSource, string> = {
  "Production traces": "Prod",
  "Human-authored": "Human",
  Synthetic: "Synthetic",
  "Review corrections": "Corrections",
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dataset" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={<span className="font-mono text-xs">{row.original.name}</span>}
        secondary={row.original.description}
        title={row.original.name}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-72 max-w-md", label: "Dataset", skeleton: "w-56" },
  }),
  col.accessor("cases", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cases" />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} />,
    meta: { width: "w-20", label: "Cases", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("sizeTrend", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Size trend"
        hint="Case count over the last 12 versions. Flat means nobody is adding review corrections."
      />
    ),
    cell: ({ getValue }) => (
      <Sparkline
        data={getValue()}
        color="var(--chart-3)"
        className="h-7 w-24"
        showEndDot={false}
      />
    ),
    enableSorting: false,
    meta: { width: "w-28", label: "Size trend", skeleton: "w-20" },
  }),
  col.accessor("sources", {
    header: "Sources",
    cell: ({ getValue }) => (
      <span className="flex flex-wrap gap-1">
        {getValue().map((s) => (
          <Badge
            key={s}
            variant="outline"
            className="h-5 px-1.5 text-2xs text-muted-foreground"
            title={s}
          >
            {sourceShort[s]}
          </Badge>
        ))}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-48", label: "Sources", skeleton: "w-32" },
  }),
  col.accessor("version", {
    header: "Version",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {getValue()}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-20", label: "Version", skeleton: "w-8" },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
  col.accessor("agentIds", {
    header: "Agents",
    cell: ({ getValue }) => {
      const ids = getValue()
      return (
        <span className="flex min-w-0 flex-col gap-0.5">
          {ids.slice(0, 2).map((id) => (
            <AgentChip key={id} agentId={id} size="sm" />
          ))}
          {ids.length > 2 && (
            <span className="text-2xs text-muted-foreground">
              +{ids.length - 2} more
            </span>
          )}
        </span>
      )
    },
    enableSorting: false,
    meta: { width: "w-44", label: "Linked agents", skeleton: "w-28" },
  }),
  col.accessor("tags", {
    header: "Coverage",
    cell: ({ getValue }) => (
      <span className="flex flex-wrap gap-1">
        {getValue()
          .slice(0, 4)
          .map((t) => (
            <code
              key={t}
              className="rounded-sm bg-muted px-1 py-0.5 font-mono text-3xs"
            >
              {t}
            </code>
          ))}
        {getValue().length > 4 && (
          <span className="text-3xs text-muted-foreground">
            +{getValue().length - 4}
          </span>
        )}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-56", label: "Coverage tags", skeleton: "w-36" },
  }),
])

const facets: FacetDef<EvalDataset>[] = [
  {
    id: "source",
    title: "Source",
    options: sources.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.sources,
  },
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentIds,
  },
]

export function DatasetsTable({
  openId,
  onOpenChange,
}: {
  openId: string | null
  onOpenChange: (id: string | null) => void
}) {
  const datasets = datasetStore.use()
  const open = datasets.find((d) => d.id === openId) ?? null
  return (
    <>
      <DataTable
        columns={columns}
        data={datasets}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.id} ${r.description} ${r.tags.join(" ")} ${r.agentIds.map((a) => getDeployedAgent(a)?.name ?? "").join(" ")}`
        }
        searchPlaceholder="Search datasets, tags…"
        facets={facets}
        initialSorting={[{ id: "updated", desc: true }]}
        onRowClick={(r) => onOpenChange(r.id)}
        totalLabel="datasets"
        caption="Golden datasets with case counts, sources, versions and linked agents"
        selectionLabel={(n) => (n === 1 ? "dataset" : "datasets")}
        toolbar={
          <NotInDemoButton reason="Creating a dataset needs the eval service. Grow an existing one from the review queue in its sheet.">
            <DatabaseIcon /> New dataset
          </NotInDemoButton>
        }
      />
      <DatasetSheet dataset={open} onClose={() => onOpenChange(null)} />
    </>
  )
}

/** JSON Lines export of the sample cases we can materialise for a dataset. */
function datasetToJsonl(d: EvalDataset) {
  const run = evalRuns.find(
    (r) =>
      r.datasetId === d.id && (r.status === "Passed" || r.status === "Failed")
  )
  const cases = run ? getEvalCases(run.id) : []
  return (
    cases
      .map((c) =>
        JSON.stringify({
          id: c.id,
          dataset: d.id,
          version: d.version,
          input: c.input,
          expected: c.expected,
          tags: c.tags,
          trace_id: c.traceId ?? null,
          source_run: run?.id,
        })
      )
      .join("\n") + "\n"
  )
}

function DatasetSheet({
  dataset: d,
  onClose,
}: {
  dataset: EvalDataset | null
  onClose: () => void
}) {
  const [addedFromReview, setAddedFromReview] = React.useState<Set<string>>(
    () => new Set()
  )
  const pendingReviews = reviewItems.filter(
    (r) =>
      d?.agentIds.includes(r.agentId) &&
      (r.status === "Corrected" || r.status === "Flagged")
  ).length
  const runs = d ? evalRuns.filter((r) => r.datasetId === d.id) : []
  const sampleRun = runs.find(
    (r) => r.status === "Passed" || r.status === "Failed"
  )
  const samples = sampleRun ? getEvalCases(sampleRun.id).slice(0, 6) : []
  const alreadyAdded = d ? addedFromReview.has(d.id) : false

  function exportJsonl() {
    if (!d) return
    const file = `${d.id}-${d.version}.jsonl`
    const body = datasetToJsonl(d)
    downloadText(file, body, "application/jsonl")
    const n = body.trim() ? body.trim().split("\n").length : 0
    toast.success("Dataset exported", {
      description: `${file} · ${n} sampled cases (the full ${formatNumber(d.cases)}-case set lives in the eval service)`,
    })
  }

  function addFromReview() {
    if (!d || pendingReviews === 0 || alreadyAdded) return
    const next = bumpVersion(d.version)
    const updated = addCasesToDataset(
      d.id,
      pendingReviews,
      `${pendingReviews} corrected and flagged reviews from the queue`
    )
    setAddedFromReview((s) => new Set(s).add(d.id))
    toast.success(
      `${pendingReviews} ${pendingReviews === 1 ? "case" : "cases"} added to ${d.name}`,
      {
        description: `${updated?.version ?? next} drafted in this session with ${formatNumber(updated?.cases ?? d.cases + pendingReviews)} cases. Resets on reload.`,
      }
    )
  }

  return (
    <Sheet open={d !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {d && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-2xs">
                  {d.version}
                </Badge>
                {d.sources.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="text-muted-foreground"
                  >
                    {s}
                  </Badge>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">
                  <UserChip userId={d.ownerId} size="xs" />
                </span>
              </div>
              <SheetTitle className="font-mono text-lg leading-tight">
                {d.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed">
                {d.description}
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricTile label="Cases" value={formatNumber(d.cases)} />
                  <MetricTile label="Runs" value={runs.length} />
                  <MetricTile
                    label="Agents"
                    value={
                      <span className="flex flex-col gap-0.5 text-sm font-medium">
                        {d.agentIds.map((id) => (
                          <AgentChip key={id} agentId={id} size="sm" />
                        ))}
                      </span>
                    }
                  />
                  <MetricTile
                    label="Growth"
                    value={
                      <Sparkline
                        data={d.sizeTrend}
                        color="var(--chart-3)"
                        className="h-8 w-full"
                      />
                    }
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Sample cases</h3>
                    {sampleRun && (
                      <Link
                        href={`/agentops/evals/${sampleRun.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        From {sampleRun.id}{" "}
                        <ArrowUpRightIcon className="size-3" />
                      </Link>
                    )}
                  </div>
                  {samples.length ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[32rem] text-sm">
                        <caption className="sr-only">
                          Six sample cases from the latest completed run on this
                          dataset
                        </caption>
                        <thead className="bg-muted/40 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">
                              Input
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Expected
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Last result
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {samples.map((c) => (
                            <tr key={c.id} className="align-top">
                              <td className="max-w-56 px-3 py-2 text-xs">
                                <span className="line-clamp-2">{c.input}</span>
                              </td>
                              <td className="max-w-64 px-3 py-2 text-xs text-muted-foreground">
                                <span className="line-clamp-2">
                                  {c.expected}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <PassFailBadge passed={c.passed} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      size="sm"
                      bare
                      icon={<PlayIcon />}
                      title="No completed run yet"
                      description="Sample results appear after the first completed run on this dataset."
                    />
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Schema</h3>
                  <DetailList
                    columns={3}
                    dense
                    items={[
                      {
                        label: "Input",
                        value: <FieldList fields={d.schema.input} />,
                      },
                      {
                        label: "Expected",
                        value: <FieldList fields={d.schema.expected} />,
                      },
                      {
                        label: "Metadata",
                        value: <FieldList fields={d.schema.metadata} />,
                      },
                    ]}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Evaluators</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {d.evaluatorIds.map((e) => {
                      const ev = getEvaluator(e)
                      return ev ? (
                        <Badge
                          key={e}
                          variant="outline"
                          className="gap-1.5 text-xs"
                        >
                          {ev.name}
                          <span className="text-muted-foreground">
                            {ev.type}
                          </span>
                        </Badge>
                      ) : null
                    })}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Coverage</h3>
                  <div className="flex flex-wrap gap-1">
                    {d.tags.map((t) => (
                      <code
                        key={t}
                        className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs"
                      >
                        {t}
                      </code>
                    ))}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Versions</h3>
                  <ol className="divide-y rounded-lg border">
                    {d.versions.map((v, i) => (
                      <li
                        key={v.version}
                        className="flex items-start gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="w-10 shrink-0 font-mono text-xs font-medium">
                          {v.version}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug">{v.note}</span>
                          <span className="block text-2xs text-muted-foreground tabular-nums">
                            {formatNumber(v.cases)} cases ·{" "}
                            <DateCell value={v.date} mode="absolute" />
                            {i === 0 && " · current"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>

                {runs.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Recent runs</h3>
                    <ul className="divide-y rounded-lg border">
                      {runs.slice(0, 5).map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/agentops/evals/${r.id}`}
                            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                          >
                            <span className="font-mono text-xs font-medium">
                              {r.id}
                            </span>
                            <AgentChip agentId={r.agentId} size="sm" />
                            <span className="ml-auto flex items-center gap-3">
                              {r.composite > 0 && (
                                <span className="font-mono text-xs tabular-nums">
                                  {r.composite}
                                </span>
                              )}
                              <RunStatusBadge status={r.status} size="sm" />
                              <DateCell value={r.started} className="text-xs" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </SheetBody>

            <SheetFooterActions
              tertiary={
                <Button variant="ghost" size="sm" onClick={exportJsonl}>
                  <DownloadIcon /> Export JSONL
                </Button>
              }
              secondary={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingReviews === 0 || alreadyAdded}
                  title={
                    pendingReviews === 0
                      ? "No corrected or flagged reviews for this dataset's agents"
                      : alreadyAdded
                        ? "Already added in this session"
                        : undefined
                  }
                  onClick={addFromReview}
                >
                  <ListPlusIcon />{" "}
                  {alreadyAdded
                    ? "Added from review queue"
                    : "Add from review queue"}
                  {pendingReviews > 0 && !alreadyAdded && (
                    <CountPill count={pendingReviews} />
                  )}
                </Button>
              }
              primary={
                <NotInDemoButton
                  size="sm"
                  reason={`Starting a run needs the eval service. This would evaluate ${d.agentIds.map((a) => getDeployedAgent(a)?.name).join(", ")} against ${d.name}.`}
                >
                  <PlayIcon /> Run eval
                </NotInDemoButton>
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function FieldList({ fields }: { fields: string[] }) {
  return (
    <span className="flex flex-col gap-0.5">
      {fields.map((f) => (
        <code key={f} className="font-mono text-2xs">
          {f}
        </code>
      ))}
    </span>
  )
}
