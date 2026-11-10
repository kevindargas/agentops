"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { MoreHorizontalIcon, StarIcon } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  actionsColumnMeta,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  selectColumn,
  TruncatedText,
  TwoLineCell,
  type DataTableFeatures,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import {
  PriorityBadge,
  SlaIndicator,
  StateBadge,
} from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import { getCi } from "@/lib/data/cmdb"
import { NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import type { Incident } from "@/lib/types"
import { incidentsStore } from "./incidents-store"

const col = createColumnHelper<DataTableFeatures, Incident>()

const closed = new Set<Incident["state"]>(["Resolved", "Closed", "Canceled"])

/** Mutations shared by the row menu and the bulk bar; every toast reflects them. */
export function assignIncidentToMe(numbers: string[]) {
  const now = NOW.toISOString()
  for (const n of numbers)
    incidentsStore.patch(n, { assignedToId: currentUser.id, updated: now })
}

export function resolveIncidents(numbers: string[]) {
  const now = NOW.toISOString()
  for (const n of numbers)
    incidentsStore.patch(n, (i) =>
      closed.has(i.state)
        ? i
        : {
            ...i,
            state: "Resolved",
            resolved: now,
            updated: now,
            slaBreached: i.slaBreached || new Date(i.slaDue) < NOW,
          }
    )
}

export function cancelIncident(number: string) {
  const now = NOW.toISOString()
  incidentsStore.patch(number, { state: "Canceled", updated: now })
}

function IncidentRowActions({ incident }: { incident: Incident }) {
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const done = closed.has(incident.state)

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(incident.number)
      toast(`Copied ${incident.number}`)
    } catch {
      toast.error("Clipboard is not available in this context")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for ${incident.number}`}
              className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={<Link href={`/itsm/incidents/${incident.number}`} />}
          >
            Open
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={done || incident.assignedToId === currentUser.id}
            onClick={() => {
              assignIncidentToMe([incident.number])
              toast.success(`${incident.number} assigned to you`)
            }}
          >
            Assign to me
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyNumber}>Copy number</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={done}
            onClick={() => {
              resolveIncidents([incident.number])
              toast.success(`${incident.number} resolved`)
            }}
          >
            Resolve
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={done}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {incident.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Canceled incidents are excluded from resolution metrics and cannot
              be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep incident</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                cancelIncident(incident.number)
                setConfirmCancel(false)
                toast(`${incident.number} canceled`)
              }}
            >
              Cancel incident
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const incidentColumns = col.columns([
  selectColumn<Incident>(),
  col.accessor("number", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        <RecordLink
          number={row.original.number}
          href={`/itsm/incidents/${row.original.number}`}
        />
        {row.original.majorIncident && (
          <StarIcon
            className="size-3 fill-destructive text-destructive"
            aria-label="Major incident"
          />
        )}
      </span>
    ),
    enableHiding: false,
    meta: { width: "w-32", label: "Number", skeleton: "w-20" },
  }),
  col.accessor("shortDescription", {
    header: "Short description",
    cell: ({ getValue, row }) => (
      <TwoLineCell
        primary={getValue()}
        secondary={`${row.original.category} · ${row.original.subcategory}`}
      />
    ),
    enableSorting: false,
    meta: { width: "min-w-64 max-w-md", skeleton: "w-56" },
  }),
  col.accessor("priority", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Priority"
        hint="Impact times urgency. P1 is critical, P5 is planning."
      />
    ),
    cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
    meta: { width: "w-32", label: "Priority", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("state", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-32", label: "State", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("callerId", {
    id: "caller",
    header: "Caller",
    cell: ({ getValue }) => <UserChip userId={getValue()} />,
    enableSorting: false,
    meta: { width: "w-44", skeleton: "w-32" },
  }),
  col.accessor("assignmentGroupId", {
    id: "assignmentGroup",
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
  col.accessor("slaDue", {
    id: "sla",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="SLA"
        hint="Time left until the resolution target for this priority"
      />
    ),
    cell: ({ row }) => (
      <SlaIndicator
        due={row.original.slaDue}
        breached={row.original.slaBreached}
        resolved={row.original.resolved}
      />
    ),
    enableSorting: false,
    meta: { width: "w-24", label: "SLA", skeleton: "w-16" },
  }),
  col.accessor("channel", {
    header: "Channel",
    cell: ({ getValue }) => <TruncatedText muted>{getValue()}</TruncatedText>,
    enableSorting: false,
    meta: { width: "w-28", skeleton: "w-16" },
  }),
  col.accessor("opened", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Opened" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Opened", skeleton: "w-16" },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
  col.display({
    id: "actions",
    cell: ({ row }) => <IncidentRowActions incident={row.original} />,
    enableSorting: false,
    enableHiding: false,
    meta: actionsColumnMeta,
  }),
])
