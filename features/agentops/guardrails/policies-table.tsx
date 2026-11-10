"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { PlusIcon, ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import {
  guardrailCategories,
  type Guardrail,
  type GuardrailMode,
  type GuardrailStatus,
} from "@/lib/data/guardrails"
import {
  CategoryBadge,
  EngineCell,
  fmtPct,
  ModeBadge,
  PolicyStatusBadge,
  ScopeCell,
} from "./shared"

const col = createColumnHelper<DataTableFeatures, Guardrail>()

const modes: GuardrailMode[] = ["Block", "Flag", "Redact", "Require approval"]
const statuses: GuardrailStatus[] = ["Active", "Disabled", "Draft"]

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
      <DataTableColumnHeader column={column} title="Mode" />
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
      <DataTableColumnHeader column={column} title="Triggers · 24h" />
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
  col.accessor("falsePositiveRate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="False pos." />
    ),
    cell: ({ getValue, row }) => {
      const v = getValue()
      if (row.original.triggers24h === 0 && v === 0)
        return <NumericCell value={null} />
      return (
        <NumericCell
          value={v}
          format={(n) => fmtPct(n)}
          className={cn(
            v >= 0.3
              ? "text-danger-text"
              : v >= 0.15
                ? "text-warning-text"
                : "text-muted-foreground"
          )}
        />
      )
    },
    meta: {
      width: "w-24",
      label: "False-positive rate",
      numeric: true,
      skeleton: "w-10",
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

const facets: FacetDef<Guardrail>[] = [
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
]

export function PoliciesTable({
  policies,
  onOpen,
}: {
  policies: Guardrail[]
  onOpen: (id: string) => void
}) {
  return (
    <DataTable
      columns={columns}
      data={policies}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.name} ${r.description} ${r.category} ${r.mode} ${r.engine} ${r.modelId ?? ""}`
      }
      searchPlaceholder="Search policies…"
      facets={facets}
      initialSorting={[{ id: "triggers24h", desc: true }]}
      onRowClick={(r) => onOpen(r.id)}
      totalLabel="policies"
      selectionLabel={(n) => (n === 1 ? "policy" : "policies")}
      emptyIcon={<ShieldCheckIcon />}
      toolbar={
        <Button
          size="sm"
          onClick={() =>
            toast("New policy", {
              description: "The policy editor opens with a YAML template.",
            })
          }
        >
          <PlusIcon /> New policy
        </Button>
      }
    />
  )
}
