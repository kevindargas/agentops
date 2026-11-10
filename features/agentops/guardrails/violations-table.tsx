"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deployedAgents } from "@/lib/data/agentops"
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
export const verdictOptions: { value: ViolationVerdict; label: string }[] = [
  { value: "Verified", label: "True positive" },
  { value: "Dismissed", label: "False positive" },
  { value: "Pending", label: "Pending" },
]
const severityRank: Record<ViolationSeverity, number> = {
  Critical: 0,
  Warning: 1,
  Info: 2,
}

function VerdictMenu({
  row,
  onVerdict,
}: {
  row: Row
  onVerdict: (ids: string[], verdict: ViolationVerdict) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Change verdict for ${row.id}`}
            className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        }
      >
        <StateBadge state={row.verdict} size="sm" />
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Reviewer verdict</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={row.verdict}
            onValueChange={(v) => onVerdict([row.id], v as ViolationVerdict)}
          >
            {verdictOptions.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function buildColumns(
  onOpenPolicy: (id: string) => void,
  onVerdict: (ids: string[], verdict: ViolationVerdict) => void
) {
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
        <DataTableColumnHeader
          column={column}
          title="Action"
          hint="What the policy did to the turn when it matched."
        />
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
        <DataTableColumnHeader
          column={column}
          title="Verdict"
          hint="Reviewer decision: Verified is a true positive, Dismissed a false positive. Dismissed verdicts drive the false-positive rate."
        />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <VerdictMenu row={row.original} onVerdict={onVerdict} />
          {row.original.reviewerId && (
            <UserChip userId={row.original.reviewerId} size="xs" hideName />
          )}
        </span>
      ),
      meta: { width: "w-40", label: "Reviewer verdict", skeleton: "w-16" },
    }),
  ])
}

export function ViolationsTable({
  violations,
  policies,
  onOpenPolicy,
  onVerdict,
  initialFacets,
}: {
  violations: GuardrailViolation[]
  policies: Guardrail[]
  onOpenPolicy: (id: string) => void
  onVerdict: (ids: string[], verdict: ViolationVerdict) => void
  initialFacets?: Record<string, string[]>
}) {
  const columns = React.useMemo(
    () => buildColumns(onOpenPolicy, onVerdict),
    [onOpenPolicy, onVerdict]
  )
  const names = new Map(policies.map((p) => [p.id, p.name]))
  const rows: Row[] = violations.map((v) => ({
    ...v,
    policyName: names.get(v.policyId) ?? v.policyId,
  }))
  const facets: FacetDef<Row>[] = [
    {
      id: "policy",
      title: "Policy",
      options: policies.map((p) => ({ value: p.id, label: p.name })),
      getValue: (r) => r.policyId,
    },
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
      options: verdictOptions,
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
      initialFacets={initialFacets}
      initialSorting={[{ id: "time", desc: true }]}
      initialColumnVisibility={{ category: false }}
      totalLabel="violations"
      caption="Guardrail violations with the policy, action, severity, trace and reviewer verdict"
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
                "Verified"
              )
              clear()
            }}
          >
            <CheckCircle2Icon /> Mark true positive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onVerdict(
                selected.map((r) => r.original.id),
                "Dismissed"
              )
              clear()
            }}
          >
            <XCircleIcon /> Mark false positive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/agentops/reviews" />}
          >
            <ClipboardCheckIcon /> Open review queue
          </Button>
        </>
      )}
    />
  )
}
