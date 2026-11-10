"use client"

import { createColumnHelper, type Row } from "@tanstack/react-table"
import { BellOffIcon, CheckIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  NumericCell,
  selectColumn,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { SeverityBadge, StateBadge } from "@/components/shared/status-badge"
import { alertSeverities } from "@/lib/constants"
import { alerts } from "@/lib/data"
import type { Alert } from "@/lib/types"

const col = createColumnHelper<DataTableFeatures, Alert>()

const alertStates: Alert["state"][] = ["Open", "Reopen", "Flapping", "Closed"]

const columns = col.columns([
  selectColumn<Alert>(),
  col.accessor("severity", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Severity" />
    ),
    cell: ({ getValue }) => <SeverityBadge severity={getValue()} />,
    sortFn: (
      a: Row<DataTableFeatures, Alert>,
      b: Row<DataTableFeatures, Alert>
    ) =>
      alertSeverities.indexOf(a.original.severity) -
      alertSeverities.indexOf(b.original.severity),
    meta: { width: "w-28", label: "Severity", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("number", {
    header: "Alert",
    cell: ({ getValue }) => <RecordLink number={getValue()} />,
    enableSorting: false,
    meta: { width: "w-32", skeleton: "w-24" },
  }),
  col.accessor("description", {
    header: "Description",
    cell: ({ getValue, row }) => (
      <TwoLineCell
        primary={getValue()}
        secondary={`${row.original.source} · ${row.original.metric}`}
        mono
      />
    ),
    enableSorting: false,
    meta: { width: "min-w-72 max-w-xl", skeleton: "w-72" },
  }),
  col.accessor("node", {
    header: "Node",
    cell: ({ getValue }) => {
      return (
        <span
          className="block max-w-48 truncate font-mono text-xs"
          title={getValue()}
        >
          {getValue()}
        </span>
      )
    },
    enableSorting: false,
    meta: { width: "w-44", skeleton: "w-32" },
  }),
  col.accessor("state", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    sortFn: (
      a: Row<DataTableFeatures, Alert>,
      b: Row<DataTableFeatures, Alert>
    ) =>
      alertStates.indexOf(a.original.state) -
      alertStates.indexOf(b.original.state),
    meta: { width: "w-28", label: "State", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("acknowledged", {
    header: "Ack",
    cell: ({ getValue }) =>
      getValue() ? (
        <span
          className="inline-flex size-5 items-center justify-center rounded-full bg-success/10 text-success-text"
          title="Acknowledged"
        >
          <CheckIcon className="size-3.5" aria-label="Acknowledged" />
        </span>
      ) : (
        <EmptyValue />
      ),
    enableSorting: false,
    meta: {
      width: "w-14",
      align: "center",
      label: "Acknowledged",
      skeleton: "size-5 rounded-full mx-auto",
    },
  }),
  col.accessor("incidentNumber", {
    id: "incident",
    header: "Incident",
    cell: ({ getValue }) => {
      const number = getValue()
      return number ? (
        <RecordLink
          number={number}
          href={`/itsm/incidents/${number}`}
          className="font-normal"
        />
      ) : (
        <EmptyValue />
      )
    },
    enableSorting: false,
    meta: { width: "w-32", skeleton: "w-20" },
  }),
  col.accessor("count", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Count" />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} />,
    meta: { width: "w-20", numeric: true, label: "Count", skeleton: "w-8" },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last event" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Last event", skeleton: "w-16" },
  }),
])

const facets: FacetDef<Alert>[] = [
  {
    id: "severity",
    title: "Severity",
    options: alertSeverities.map((s) => ({ label: s, value: s })),
    getValue: (r) => r.severity,
  },
  {
    id: "state",
    title: "State",
    options: alertStates.map((s) => ({ label: s, value: s })),
    getValue: (r) => r.state,
  },
  {
    id: "source",
    title: "Source",
    options: Array.from(new Set(alerts.map((a) => a.source)))
      .sort()
      .map((s) => ({ label: s, value: s })),
    getValue: (r) => r.source,
  },
  {
    id: "ack",
    title: "Acknowledged",
    options: [
      { label: "Acknowledged", value: "yes" },
      { label: "Unacknowledged", value: "no" },
    ],
    getValue: (r) => (r.acknowledged ? "yes" : "no"),
  },
]

export function AlertsTable() {
  return (
    <DataTable
      columns={columns}
      data={alerts}
      getRowId={(r) => r.number}
      getSearchText={(r) =>
        `${r.number} ${r.description} ${r.node} ${r.source} ${r.metric}`
      }
      searchPlaceholder="Search alerts…"
      facets={facets}
      initialFacets={{ state: ["Open", "Reopen", "Flapping"] }}
      initialSorting={[{ id: "severity", desc: false }]}
      density="compact"
      totalLabel="alerts"
      emptyTitle="No active alerts"
      emptyMessage="Everything is quiet. Alerts from monitoring sources will appear here."
      selectionLabel={(n) => (n === 1 ? "alert" : "alerts")}
      bulkActions={(rows, clear) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.success(
                `${rows.length} alert${rows.length === 1 ? "" : "s"} acknowledged`
              )
              clear()
            }}
          >
            <CheckIcon /> Acknowledge
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.success(
                `Incident created from ${rows.length} alert${rows.length === 1 ? "" : "s"}`
              )
              clear()
            }}
          >
            <LinkIcon /> Create incident
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast(
                `${rows.length} alert${rows.length === 1 ? "" : "s"} closed`
              )
              clear()
            }}
          >
            <BellOffIcon /> Close
          </Button>
        </>
      )}
    />
  )
}
