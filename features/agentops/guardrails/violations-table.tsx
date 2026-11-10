"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createColumnHelper } from "@tanstack/react-table"
import { ClipboardCheckIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  selectColumn,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import { deployedAgents } from "@/lib/data"
import {
  guardrailCategories,
  type Guardrail,
  type GuardrailViolation,
  type ViolationAction,
  type ViolationSeverity,
  type ViolationVerdict,
} from "@/lib/data/guardrails"
import { AgentChip } from "../shared"
import { ActionBadge, CategoryBadge } from "./shared"

type Row = GuardrailViolation & { policyName: string }

const col = createColumnHelper<DataTableFeatures, Row>()
const actions: ViolationAction[] = [
  "Blocked",
  "Flagged",
  "Redacted",
  "Approval requested",
]
const severities: ViolationSeverity[] = ["Critical", "Warning", "Info"]
const verdicts: { value: ViolationVerdict; label: string }[] = [
  { value: "Verified", label: "True positive" },
  { value: "Dismissed", label: "False positive" },
  { value: "Pending", label: "Pending" },
]
const severityRank: Record<ViolationSeverity, number> = {
  Critical: 0,
  Warning: 1,
  Info: 2,
}

function buildColumns(onOpenPolicy: (id: string) => void) {
  return col.columns([
    selectColumn<Row>(),
    col.accessor("time", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Time" />
      ),
      cell: ({ getValue }) => <DateCell value={getValue()} mode="datetime" />,
      meta: { width: "w-32", label: "Time", skeleton: "w-20" },
    }),
    col.accessor("agentId", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Agent" />
      ),
      cell: ({ getValue }) => <AgentChip agentId={getValue()} />,
      meta: { width: "w-44", label: "Agent", skeleton: "w-28" },
    }),
    col.accessor("policyName", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Policy" />
      ),
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onOpenPolicy(row.original.policyId)}
          className="block max-w-full truncate text-left font-medium underline-offset-4 hover:underline"
          title={row.original.policyName}
        >
          {row.original.policyName}
        </button>
      ),
      meta: { width: "min-w-48 max-w-64", label: "Policy", skeleton: "w-36" },
    }),
    col.accessor("category", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
      meta: { width: "w-28", label: "Category", skeleton: "w-16 rounded-full" },
    }),
    col.accessor("action", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Action" />
      ),
      cell: ({ getValue }) => <ActionBadge action={getValue()} />,
      meta: {
        width: "w-40",
        label: "Action taken",
        skeleton: "w-20 rounded-full",
      },
    }),
    col.accessor("severity", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Severity" />
      ),
      cell: ({ getValue }) => <StateBadge state={getValue()} size="sm" />,
      sortFn: (a, b) =>
        severityRank[a.original.severity] - severityRank[b.original.severity],
      meta: { width: "w-24", label: "Severity", skeleton: "w-14 rounded-full" },
    }),
    col.accessor("snippet", {
      header: "Snippet",
      cell: ({ getValue }) => (
        <TruncatedText className="font-mono text-xs text-muted-foreground">
          {getValue()}
        </TruncatedText>
      ),
      enableSorting: false,
      meta: { width: "min-w-56 max-w-sm", label: "Snippet", skeleton: "w-48" },
    }),
    col.accessor("traceId", {
      header: "Trace",
      cell: ({ getValue }) => (
        <Link
          href={`/agentops/traces/${getValue()}`}
          className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {getValue()}
        </Link>
      ),
      enableSorting: false,
      meta: { width: "w-28", label: "Trace", skeleton: "w-20" },
    }),
    col.accessor("verdict", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Verdict" />
      ),
      cell: ({ row }) => {
        const v = row.original.verdict
        return (
          <span className="flex items-center gap-2">
            <StateBadge state={v} size="sm" />
            {row.original.reviewerId && (
              <UserChip userId={row.original.reviewerId} size="xs" hideName />
            )}
          </span>
        )
      },
      meta: { width: "w-32", label: "Reviewer verdict", skeleton: "w-16" },
    }),
  ])
}

export function ViolationsTable({
  violations,
  policies,
  onOpenPolicy,
  onVerdict,
}: {
  violations: GuardrailViolation[]
  policies: Guardrail[]
  onOpenPolicy: (id: string) => void
  onVerdict: (ids: string[], verdict: ViolationVerdict) => void
}) {
  const router = useRouter()
  const columns = React.useMemo(
    () => buildColumns(onOpenPolicy),
    [onOpenPolicy]
  )
  const names = new Map(policies.map((p) => [p.id, p.name]))
  const rows: Row[] = violations.map((v) => ({
    ...v,
    policyName: names.get(v.policyId) ?? v.policyId,
  }))
  const facets: FacetDef<Row>[] = [
    {
      id: "action",
      title: "Action",
      options: actions.map((a) => ({ value: a, label: a })),
      getValue: (r) => r.action,
    },
    {
      id: "severity",
      title: "Severity",
      options: severities.map((s) => ({ value: s, label: s })),
      getValue: (r) => r.severity,
    },
    {
      id: "verdict",
      title: "Verdict",
      options: verdicts,
      getValue: (r) => r.verdict,
    },
    {
      id: "category",
      title: "Category",
      options: guardrailCategories.map((c) => ({ value: c, label: c })),
      getValue: (r) => r.category,
    },
    {
      id: "agent",
      title: "Agent",
      options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
      getValue: (r) => r.agentId,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.policyName} ${r.snippet} ${r.traceId} ${r.action} ${r.severity}`
      }
      searchPlaceholder="Search violations…"
      facets={facets}
      initialSorting={[{ id: "time", desc: true }]}
      initialColumnVisibility={{ category: false }}
      totalLabel="violations"
      selectionLabel={(n) => (n === 1 ? "violation" : "violations")}
      emptyIcon={<ShieldCheckIcon />}
      emptyTitle="No violations"
      emptyMessage="Nothing has tripped a policy in this window."
      bulkActions={(selected, clear) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onVerdict(
                selected.map((r) => r.original.id),
                "Dismissed"
              )
              toast.success(
                `${selected.length} violation${selected.length === 1 ? "" : "s"} marked false positive`,
                {
                  description:
                    "Feedback is attached to the policy and lowers its precision score.",
                }
              )
              clear()
            }}
          >
            <XCircleIcon /> Mark false positive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast("Opening review queue", {
                description: `${selected.length} trace${selected.length === 1 ? "" : "s"} added for human review.`,
              })
              clear()
              router.push("/agentops/reviews")
            }}
          >
            <ClipboardCheckIcon /> Open review
          </Button>
        </>
      )}
    />
  )
}
