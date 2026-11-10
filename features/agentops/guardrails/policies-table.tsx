"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { ShieldCheckIcon } from "lucide-react"

import { Sparkline } from "@/components/charts/sparkline"
import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { UserChip } from "@/components/shared/user-chip"
import {
  guardrailCategories,
  type Guardrail,
  type GuardrailFailMode,
  type GuardrailMode,
  type GuardrailStatus,
  type GuardrailViolation,
} from "@/lib/data/guardrails"
import { formatMs } from "@/lib/format"
import {
  bypassAlertThreshold,
  CategoryBadge,
  EngineCell,
  FailModeBadge,
  failModeMeta,
  fmtPct,
  ModeBadge,
  PolicyStatusBadge,
  ScopeCell,
} from "./shared"
import { falsePositiveRate, fpTone } from "./store"

/** Policy row with the false-positive figures derived from the violations log. */
type Row = Guardrail & {
  fpRate: number | null
  fpDecided: number
}

const col = createColumnHelper<DataTableFeatures, Row>()

const modes: GuardrailMode[] = ["Block", "Flag", "Redact", "Require approval"]
const statuses: GuardrailStatus[] = ["Active", "Disabled", "Draft"]
const failModes: GuardrailFailMode[] = ["fail_closed", "fail_open"]

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Policy" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={row.original.name}
        secondary={row.original.description}
        className={cn(row.original.status !== "Active" && "opacity-70")}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-72 max-w-md", label: "Policy", skeleton: "w-56" },
  }),
  col.accessor("category", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
    meta: { width: "w-28", label: "Category", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("mode", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Mode"
        hint="What happens when the policy matches: block the turn, flag it for review, redact the match or pause for approval."
      />
    ),
    cell: ({ getValue }) => <ModeBadge mode={getValue()} />,
    meta: { width: "w-36", label: "Mode", skeleton: "w-16 rounded-full" },
  }),
  col.accessor((r) => (r.scope === "all" ? 99 : r.scope.length), {
    id: "scope",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scope" />
    ),
    cell: ({ row }) => <ScopeCell scope={row.original.scope} />,
    meta: { width: "w-28", label: "Scope", skeleton: "w-16" },
  }),
  col.accessor("engine", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Engine" />
    ),
    cell: ({ row }) => <EngineCell policy={row.original} />,
    meta: { width: "w-44", label: "Engine", skeleton: "w-24" },
  }),
  col.accessor("triggers24h", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Triggers · 24h"
        hint="Times the policy matched in the last 24 hours; the sparkline is the last 14 days."
      />
    ),
    cell: ({ row }) => {
      const g = row.original
      return (
        <span className="flex items-center justify-end gap-3">
          <Sparkline
            data={g.history}
            className="h-7 w-20"
            color={
              g.status !== "Active"
                ? "var(--muted-foreground)"
                : g.mode === "Block"
                  ? "var(--chart-5)"
                  : "var(--chart-1)"
            }
            showEndDot={false}
            strokeWidth={1.25}
          />
          <NumericCell
            value={g.triggers24h}
            className="w-10 font-medium"
            muted={g.status !== "Active"}
          />
        </span>
      )
    },
    meta: {
      width: "w-40",
      label: "Triggers (24h)",
      numeric: true,
      skeleton: "w-24",
    },
  }),
  col.accessor("fpRate", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="False pos."
        hint="Reviewer verdicts marked false positive divided by all decided verdicts on this policy. Blank until a reviewer has decided at least one violation."
      />
    ),
    cell: ({ row }) => {
      const v = row.original.fpRate
      if (v === null) return <NumericCell value={null} />
      const tone = fpTone(v)
      return (
        <NumericCell
          value={v}
          format={(n) => fmtPct(n)}
          className={cn(
            tone === "danger"
              ? "text-danger-text"
              : tone === "warning"
                ? "text-warning-text"
                : "text-muted-foreground"
          )}
        />
      )
    },
    sortFn: (a, b) => (a.original.fpRate ?? -1) - (b.original.fpRate ?? -1),
    meta: {
      width: "w-24",
      label: "False-positive rate",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("failMode", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Fail mode"
        hint="Behaviour when the engine itself errors or times out: fail closed rejects the turn, fail open lets it through unguarded."
      />
    ),
    cell: ({ getValue }) => <FailModeBadge failMode={getValue()} size="sm" />,
    meta: {
      width: "w-28",
      label: "Fail mode",
      skeleton: "w-16 rounded-full",
    },
  }),
  col.accessor("p95Ms", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="p95"
        hint="95th percentile of the latency this policy adds to a turn."
      />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={formatMs}
        className={cn(getValue() >= 1000 && "text-warning-text")}
        muted={getValue() < 1000}
      />
    ),
    meta: {
      width: "w-20",
      label: "p95 evaluation latency",
      numeric: true,
      skeleton: "w-8",
    },
  }),
  col.accessor("bypassRate", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Bypass"
        hint="Share of red-team attack cases that got past the policy on its last red-team eval run. Above 5% is a finding."
      />
    ),
    cell: ({ getValue, row }) => {
      const v = getValue()
      if (!row.original.lastRedTeamRunId) return <NumericCell value={null} />
      return (
        <NumericCell
          value={v}
          format={(n) => fmtPct(n, 1)}
          className={cn(
            v > bypassAlertThreshold
              ? "font-medium text-danger-text"
              : "text-muted-foreground"
          )}
        />
      )
    },
    meta: {
      width: "w-20",
      label: "Red-team bypass rate",
      numeric: true,
      skeleton: "w-8",
    },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => <PolicyStatusBadge status={getValue()} />,
    meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
])

const facets: FacetDef<Row>[] = [
  {
    id: "category",
    title: "Category",
    options: guardrailCategories.map((c) => ({ value: c, label: c })),
    getValue: (r) => r.category,
  },
  {
    id: "mode",
    title: "Mode",
    options: modes.map((m) => ({ value: m, label: m })),
    getValue: (r) => r.mode,
  },
  {
    id: "status",
    title: "Status",
    options: statuses.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.status,
  },
  {
    id: "failMode",
    title: "Fail mode",
    options: failModes.map((m) => ({ value: m, label: failModeMeta[m].label })),
    getValue: (r) => r.failMode,
  },
]

export function PoliciesTable({
  policies,
  violations,
  onOpen,
}: {
  policies: Guardrail[]
  violations: GuardrailViolation[]
  onOpen: (id: string) => void
}) {
  const rows = React.useMemo<Row[]>(
    () =>
      policies.map((g) => {
        const fp = falsePositiveRate(violations, g.id)
        return { ...g, fpRate: fp.rate, fpDecided: fp.decided }
      }),
    [policies, violations]
  )
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.name} ${r.description} ${r.category} ${r.mode} ${r.engine} ${r.modelId ?? ""} ${r.failMode} ${r.languages.join(" ")}`
      }
      searchPlaceholder="Search policies…"
      facets={facets}
      initialSorting={[{ id: "triggers24h", desc: true }]}
      initialColumnVisibility={{ ownerId: false }}
      onRowClick={(r) => onOpen(r.id)}
      totalLabel="policies"
      caption="Guardrail policies with mode, scope, engine, trigger counts and effectiveness"
      selectionLabel={(n) => (n === 1 ? "policy" : "policies")}
      emptyIcon={<ShieldCheckIcon />}
    />
  )
}
