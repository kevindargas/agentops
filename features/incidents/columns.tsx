"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { MoreHorizontalIcon, StarIcon } from "lucide-react"
import { toast } from "sonner"

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
import type { Incident } from "@/lib/types"

const col = createColumnHelper<DataTableFeatures, Incident>()

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
    header: "Configuration item",
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
    meta: { label: "Configuration item", skeleton: "w-28" },
  }),
  col.accessor("slaDue", {
    id: "sla",
    header: "SLA",
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
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for ${row.original.number}`}
              className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={<Link href={`/itsm/incidents/${row.original.number}`} />}
          >
            Open
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              toast.success(`${row.original.number} assigned to you`)
            }
          >
            Assign to me
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard?.writeText(row.original.number)
              toast(`Copied ${row.original.number}`)
            }}
          >
            Copy number
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toast.success(`${row.original.number} resolved`)}
          >
            Resolve
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => toast(`${row.original.number} canceled`)}
          >
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: actionsColumnMeta,
  }),
])
