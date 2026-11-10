"use client"

import * as React from "react"
import { createColumnHelper, type Row } from "@tanstack/react-table"
import { BellOffIcon, CheckIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import type { Alert } from "@/lib/types"
import { ALERT_PARAM, AlertSheet, useAlertParam } from "./alert-sheet"
import {
  acknowledgeAlerts,
  alertsStore,
  closeAlerts,
  promoteAlerts,
} from "./alerts-store"

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
    cell: ({ getValue }) => (
      <RecordLink number={getValue()} href={`?${ALERT_PARAM}=${getValue()}`} />
    ),
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
    cell: ({ getValue }) => (
      <span
        className="block max-w-48 truncate font-mono text-xs"
        title={getValue()}
      >
        {getValue()}
      </span>
    ),
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
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Ack"
        align="center"
        hint="Acknowledged by an operator"
      />
    ),
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
      <DataTableColumnHeader
        column={column}
        title="Count"
        hint="Monitoring events de-duplicated into this alert"
      />
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

const facetSources = (list: Alert[]) =>
  Array.from(new Set(list.map((a) => a.source)))
    .sort()
    .map((s) => ({ label: s, value: s }))

const plural = (n: number) => `${n} alert${n === 1 ? "" : "s"}`

/** Alerts list. Rows open the detail sheet (`?alert=`); bulk actions mutate the shared store. */
export function AlertsTable() {
  const list = alertsStore.use()
  const [, setAlertParam] = useAlertParam()
  const [pendingClose, setPendingClose] = React.useState<{
    numbers: string[]
    clear: () => void
  } | null>(null)

  const facets = React.useMemo<FacetDef<Alert>[]>(
    () => [
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
        options: facetSources(list),
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
    ],
    [list]
  )

  function confirmClose() {
    if (!pendingClose) return
    closeAlerts(pendingClose.numbers)
    pendingClose.clear()
    toast(`${plural(pendingClose.numbers.length)} closed`)
    setPendingClose(null)
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={list}
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
        caption="Alerts"
        onRowClick={(r) => setAlertParam(r.number)}
        emptyTitle="No active alerts"
        emptyMessage="Everything is quiet. Alerts from monitoring sources will appear here."
        selectionLabel={(n) => (n === 1 ? "alert" : "alerts")}
        bulkActions={(rows, clear) => {
          const numbers = rows.map((r) => r.original.number)
          return (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  acknowledgeAlerts(numbers)
                  toast.success(`${plural(numbers.length)} acknowledged`)
                  clear()
                }}
              >
                <CheckIcon /> Acknowledge
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const incident = promoteAlerts(numbers)
                  toast.success(
                    `${incident} linked to ${plural(numbers.length)}`,
                    {
                      description:
                        "The incident number is recorded on the alerts in this session.",
                    }
                  )
                  clear()
                }}
              >
                <LinkIcon /> Create incident
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingClose({ numbers, clear })}
              >
                <BellOffIcon /> Close
              </Button>
            </>
          )
        }}
      />
      <AlertSheet />
      <AlertDialog
        open={Boolean(pendingClose)}
        onOpenChange={(o) => !o && setPendingClose(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Close {pendingClose ? plural(pendingClose.numbers.length) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Closed alerts leave the open list. New events on the same node and
              metric will reopen them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmClose}>
              Close alerts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
