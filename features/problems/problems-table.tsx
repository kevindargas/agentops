"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { BookMarkedIcon } from "lucide-react"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  NumericCell,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { PriorityBadge, StateBadge } from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import { priorityLabels, problemStates } from "@/lib/constants"
import { getCi } from "@/lib/data/cmdb"
import { groups } from "@/lib/data/users"
import type { Priority, Problem } from "@/lib/types"
import { problemsStore } from "./problems-store"

const col = createColumnHelper<DataTableFeatures, Problem>()

const columns = col.columns([
  col.accessor("number", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
    cell: ({ getValue, row }) => (
      <span className="inline-flex items-center gap-1.5">
        <RecordLink number={getValue()} href={`/itsm/problems/${getValue()}`} />
        {row.original.knownError && (
          <BookMarkedIcon
            className="size-3 text-warning-text"
            aria-label="Known error"
          />
        )}
      </span>
    ),
    enableHiding: false,
    meta: { width: "w-32", label: "Number", skeleton: "w-24" },
  }),
  col.accessor("shortDescription", {
    header: "Short description",
    cell: ({ getValue }) => (
      <TruncatedText className="font-medium">{getValue()}</TruncatedText>
    ),
    enableSorting: false,
    meta: { width: "min-w-64 max-w-lg", skeleton: "w-64" },
  }),
  col.accessor("priority", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Priority" />
    ),
    cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
    meta: { width: "w-32", label: "Priority", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("state", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-40", label: "State", skeleton: "w-24 rounded-full" },
  }),
  col.accessor("relatedIncidents", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Incidents"
        hint="Incidents that carry this problem as their cause"
      />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} />,
    meta: { width: "w-24", numeric: true, label: "Incidents", skeleton: "w-8" },
  }),
  col.accessor("ciId", {
    id: "ci",
    header: "Affected service",
    cell: ({ getValue }) => {
      const ci = getCi(getValue())
      return ci ? (
        <span className="block max-w-48 truncate text-sm" title={ci.name}>
          {ci.name}
        </span>
      ) : (
        <EmptyValue />
      )
    },
    enableSorting: false,
    meta: { label: "Affected service", skeleton: "w-28" },
  }),
  col.accessor("assignmentGroupId", {
    id: "group",
    header: "Assignment group",
    cell: ({ getValue }) => <GroupChip groupId={getValue()} />,
    enableSorting: false,
    meta: { width: "w-44 max-w-48", skeleton: "w-32" },
  }),
  col.accessor("assignedToId", {
    id: "assignedTo",
    header: "Assigned to",
    cell: ({ getValue }) => <UserChip userId={getValue()} />,
    enableSorting: false,
    meta: { width: "w-44", skeleton: "w-32" },
  }),
  col.accessor("opened", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Opened" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Opened", skeleton: "w-16" },
  }),
])

const facets: FacetDef<Problem>[] = [
  {
    id: "state",
    title: "State",
    options: problemStates.map((s) => ({ label: s, value: s })),
    getValue: (r) => r.state,
  },
  {
    id: "priority",
    title: "Priority",
    options: ([1, 2, 3, 4, 5] as Priority[]).map((p) => ({
      label: `P${p} · ${priorityLabels[p]}`,
      value: String(p),
    })),
    getValue: (r) => String(r.priority),
  },
  {
    id: "knownError",
    title: "Known error",
    options: [
      { label: "Known error", value: "yes" },
      { label: "Not a known error", value: "no" },
    ],
    getValue: (r) => (r.knownError ? "yes" : "no"),
  },
  {
    id: "group",
    title: "Group",
    options: groups
      .filter((g) => g.type === "itil")
      .map((g) => ({ label: g.name, value: g.id })),
    getValue: (r) => r.assignmentGroupId,
  },
]

/** Problem list. Reads `problemsStore` so a problem created from the sheet appears. */
export function ProblemsTable() {
  const problems = problemsStore.use()
  return (
    <DataTable
      columns={columns}
      data={problems}
      getRowId={(r) => r.number}
      getSearchText={(r) => `${r.number} ${r.shortDescription}`}
      searchPlaceholder="Search problems…"
      facets={facets}
      initialSorting={[{ id: "relatedIncidents", desc: true }]}
      rowHref={(r) => `/itsm/problems/${r.number}`}
      totalLabel="problems"
      caption="Problems"
    />
  )
}
