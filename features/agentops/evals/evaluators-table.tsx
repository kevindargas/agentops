"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { PlusIcon, SlidersHorizontalIcon, SparklesIcon } from "lucide-react"
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
  evaluators as seed,
  getDataset,
  type Evaluator,
  type EvaluatorScale,
  type EvaluatorType,
} from "@/lib/data/evals"
import { ModelChip } from "@/features/agentops/shared"
import { fmtCost } from "./shared"

const col = createColumnHelper<DataTableFeatures, Evaluator>()
const types: EvaluatorType[] = [
  "LLM-as-judge",
  "Rubric",
  "Exact match",
  "JSON schema",
  "Embedding similarity",
  "Regex",
  "Custom code",
  "Human",
]
const scales: EvaluatorScale[] = ["0–1", "1–5", "pass/fail"]

function agreementClass(n: number) {
  return n >= 90
    ? "text-success-text"
    : n >= 80
      ? undefined
      : "text-warning-text"
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Evaluator" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={row.original.name}
        secondary={row.original.description}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-64 max-w-md", label: "Evaluator", skeleton: "w-48" },
  }),
  col.accessor("type", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col gap-1">
        <Badge variant="outline" className="w-fit text-[11px]">
          {row.original.type}
        </Badge>
        {row.original.modelId && (
          <ModelChip
            modelId={row.original.modelId}
            className="text-[11px] text-muted-foreground"
          />
        )}
      </span>
    ),
    meta: { width: "w-44", label: "Type", skeleton: "w-24" },
  }),
  col.accessor("measures", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Measures" />
    ),
    cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
    meta: { width: "w-36", label: "Measures", skeleton: "w-24" },
  }),
  col.accessor("scale", {
    header: "Scoring",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {getValue()}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-20", label: "Scoring", skeleton: "w-10" },
  }),
  col.accessor("costPerCase", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost / case" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => (n === 0 ? "free" : fmtCost(n, 4))}
        muted
      />
    ),
    meta: {
      width: "w-24",
      label: "Cost per case",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor("humanAgreement", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Human agreement" />
    ),
    cell: ({ getValue, row }) =>
      row.original.type === "Human" ? (
        <span className="block text-right text-xs text-muted-foreground">
          reference
        </span>
      ) : (
        <NumericCell
          value={getValue()}
          format={(n) => `${n}%`}
          className={agreementClass(getValue())}
        />
      ),
    meta: {
      width: "w-32",
      label: "Agreement with human labels",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor((r) => r.usedInDatasetIds.length, {
    id: "datasets",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Datasets" />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} />,
    meta: {
      width: "w-24",
      label: "Used in datasets",
      numeric: true,
      skeleton: "w-8",
    },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
])

const facets: FacetDef<Evaluator>[] = [
  {
    id: "type",
    title: "Type",
    options: types.map((t) => ({ value: t, label: t })),
    getValue: (r) => r.type,
  },
  {
    id: "scale",
    title: "Scoring",
    options: scales.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.scale,
  },
]

export function EvaluatorsTable() {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const open = seed.find((e) => e.id === openId) ?? null
  return (
    <>
      <DataTable
        columns={columns}
        data={seed}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.type} ${r.measures} ${r.description} ${r.modelId ?? ""}`
        }
        searchPlaceholder="Search evaluators…"
        facets={facets}
        initialSorting={[{ id: "datasets", desc: true }]}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="evaluators"
        selectionLabel={(n) => (n === 1 ? "evaluator" : "evaluators")}
        toolbar={
          <Button size="sm" onClick={() => toast("Evaluator editor opened")}>
            <PlusIcon /> New evaluator
          </Button>
        }
      />
      <EvaluatorSheet evaluator={open} onClose={() => setOpenId(null)} />
    </>
  )
}

const week = (i: number) =>
  new Date(Date.UTC(2026, 10, 5 - (11 - i) * 7)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

function EvaluatorSheet({
  evaluator: e,
  onClose,
}: {
  evaluator: Evaluator | null
  onClose: () => void
}) {
  const series = e
    ? e.calibration.map((v, i) => ({ name: week(i), agreement: v }))
    : []
  const isCode =
    e?.type === "Custom code" ||
    e?.type === "JSON schema" ||
    e?.type === "Regex" ||
    e?.type === "Exact match" ||
    e?.type === "Embedding similarity"
  return (
    <Sheet open={e !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {e && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{e.type}</Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {e.measures}
                </Badge>
                <Badge
                  variant="outline"
                  className="font-mono text-muted-foreground"
                >
                  {e.scale}
                </Badge>
                {e.modelId && (
                  <ModelChip modelId={e.modelId} className="ml-auto text-xs" />
                )}
              </div>
              <SheetTitle className="text-lg leading-tight">
                {e.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed">
                {e.description}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fact
                    label="Human agreement"
                    value={
                      e.type === "Human" ? (
                        "reference"
                      ) : (
                        <span className={agreementClass(e.humanAgreement)}>
                          {e.humanAgreement}%
                        </span>
                      )
                    }
                  />
                  <Fact
                    label="Cost / case"
                    value={
                      e.costPerCase === 0 ? "free" : fmtCost(e.costPerCase, 4)
                    }
                  />
                  <Fact label="Datasets" value={e.usedInDatasetIds.length} />
                  <Fact
                    label="Owner"
                    value={<UserChip userId={e.ownerId} size="xs" />}
                  />
                </section>

                {e.type !== "Human" && (
                  <section className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">Calibration</h3>
                      <span className="text-xs text-muted-foreground">
                        Agreement with human labels, weekly · 12 weeks
                      </span>
                    </div>
                    <IncidentTrendChart
                      data={series}
                      xKey="name"
                      series={[
                        {
                          key: "agreement",
                          label: "Agreement",
                          color: "var(--chart-1)",
                        },
                      ]}
                      height={180}
                      showLegend={false}
                      valueFormatter={(v) => `${v}%`}
                    />
                    {e.humanAgreement < 80 && (
                      <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning-text">
                        Below the 80% agreement floor — use only alongside a
                        second evaluator, and schedule a recalibration from the
                        latest review-queue labels.
                      </p>
                    )}
                  </section>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    {isCode
                      ? "Implementation"
                      : e.type === "Rubric"
                        ? "Rubric"
                        : e.type === "Human"
                          ? "Reviewer rubric"
                          : "Judge prompt"}
                  </h3>
                  <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {e.prompt}
                  </pre>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Used in datasets</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {e.usedInDatasetIds.map((id) => (
                      <code
                        key={id}
                        className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                      >
                        {getDataset(id)?.name ?? id}
                      </code>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              {e.type !== "Human" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast("Calibration run queued", {
                      description:
                        "Scoring the last 50 human-labelled cases from the review queue",
                    })
                  }
                >
                  <SparklesIcon /> Recalibrate
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => toast("Evaluator editor opened")}
              >
                <SlidersHorizontalIcon /> Edit
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
}
