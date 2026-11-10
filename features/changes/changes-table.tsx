"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createColumnHelper, type Row } from "@tanstack/react-table"
import { cn } from "cn"
import { CalendarDaysIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { RiskBadge, StateBadge } from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import { changeRisks, changeStates, changeTypes } from "@/lib/constants"
import { getCi } from "@/lib/data/cmdb"
import type { Change } from "@/lib/types"
import { changesStore } from "./changes-store"

const col = createColumnHelper<DataTableFeatures, Change>()

const typeTone: Record<Change["type"], string> = {
  Standard: "bg-muted text-muted-foreground",
  Normal: "bg-info/10 text-info-text",
  Emergency: "bg-destructive/10 text-danger-text",
}

export function ChangeTypePill({
  type,
  className,
}: {
  type: Change["type"]
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap",
        typeTone[type],
        className
      )}
    >
      {type}
    </span>
  )
}

const columns = col.columns([
  col.accessor("number", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
    cell: ({ getValue }) => (
      <RecordLink number={getValue()} href={`/itsm/changes/${getValue()}`} />
    ),
    enableHiding: false,
    meta: { width: "w-32", label: "Number", skeleton: "w-24" },
  }),
  col.accessor("shortDescription", {
    header: "Short description",
    cell: ({ getValue, row }) => {
      const ci = row.original.ciId ? getCi(row.original.ciId)?.name : undefined
      return (
        <TwoLineCell
          primary={getValue()}
          secondary={
            ci ? `${row.original.category} · ${ci}` : row.original.category
          }
        />
      )
    },
    enableSorting: false,
    meta: { width: "min-w-64 max-w-md", skeleton: "w-56" },
  }),
  col.accessor("type", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ getValue }) => <ChangeTypePill type={getValue()} />,
    sortFn: (
      a: Row<DataTableFeatures, Change>,
      b: Row<DataTableFeatures, Change>
    ) =>
      changeTypes.indexOf(a.original.type) -
      changeTypes.indexOf(b.original.type),
    meta: { width: "w-28", label: "Type", skeleton: "w-16" },
  }),
  col.accessor("state", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    sortFn: (
      a: Row<DataTableFeatures, Change>,
      b: Row<DataTableFeatures, Change>
    ) =>
      changeStates.indexOf(a.original.state) -
      changeStates.indexOf(b.original.state),
    meta: { width: "w-32", label: "State", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("risk", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Risk"
        hint="Assessed risk. Normal changes above Low go to the CAB."
      />
    ),
    cell: ({ getValue }) => <RiskBadge risk={getValue()} />,
    sortFn: (
      a: Row<DataTableFeatures, Change>,
      b: Row<DataTableFeatures, Change>
    ) =>
      changeRisks.indexOf(a.original.risk) -
      changeRisks.indexOf(b.original.risk),
    meta: { width: "w-28", label: "Risk", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("approval", {
    header: "Approval",
    cell: ({ getValue }) => <StateBadge state={getValue()} dot={false} />,
    enableSorting: false,
    meta: { width: "w-36", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("plannedStart", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Planned start" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} mode="datetime" />,
    meta: { width: "w-36", label: "Planned start", skeleton: "w-24" },
  }),
  col.accessor("plannedEnd", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Planned end" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} mode="datetime" />,
    meta: { width: "w-36", label: "Planned end", skeleton: "w-24" },
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
])

const facets: FacetDef<Change>[] = [
  {
    id: "type",
    title: "Type",
    options: changeTypes.map((t) => ({ label: t, value: t })),
    getValue: (r) => r.type,
  },
  {
    id: "state",
    title: "State",
    options: changeStates.map((s) => ({ label: s, value: s })),
    getValue: (r) => r.state,
  },
  {
    id: "risk",
    title: "Risk",
    options: changeRisks.map((r) => ({ label: r, value: r })),
    getValue: (r) => r.risk,
  },
  {
    id: "approval",
    title: "Approval",
    options: ["Not Yet Requested", "Requested", "Approved", "Rejected"].map(
      (a) => ({ label: a, value: a })
    ),
    getValue: (r) => r.approval,
  },
]

/**
 * Change list. Reads `changesStore` so a change created from the New change
 * sheet appears without a reload. `?view=cab` narrows to the CAB agenda.
 */
export function ChangesTable() {
  const params = useSearchParams()
  const changes = changesStore.use()
  const view = params.get("view")
  const data =
    view === "cab"
      ? changes.filter(
          (c) => c.cabRequired && ["Assess", "Authorize"].includes(c.state)
        )
      : changes
  return (
    <DataTable
      key={view ?? "all"}
      columns={columns}
      data={data}
      getRowId={(r) => r.number}
      getSearchText={(r) => `${r.number} ${r.shortDescription} ${r.category}`}
      searchPlaceholder="Search changes…"
      facets={facets}
      initialSorting={[{ id: "plannedStart", desc: false }]}
      initialColumnVisibility={{ assignedTo: false, plannedEnd: false }}
      rowHref={(r) => `/itsm/changes/${r.number}`}
      totalLabel="changes"
      caption="Changes"
      emptyTitle={view === "cab" ? "CAB agenda is empty" : undefined}
      emptyMessage={
        view === "cab"
          ? "No changes are waiting for assessment or authorization."
          : undefined
      }
      toolbar={
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/itsm/changes/calendar" />}
        >
          <CalendarDaysIcon /> Calendar
        </Button>
      }
    />
  )
}
