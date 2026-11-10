"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { FileClockIcon } from "lucide-react"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { StateBadge } from "@/components/shared/status-badge"
import {
  auditActionFamily,
  auditActorKinds,
  auditSourceLabel,
  auditSources,
  type AuditEvent,
} from "@/lib/data/audit"
import { sessionAuditIds } from "./audit-store"
import {
  ActionBadge,
  actionFamilies,
  actionFamilyLabel,
  ActorChip,
  actorKindLabel,
  HashChip,
  SourceChip,
  targetKindLabel,
} from "./shared"

const col = createColumnHelper<DataTableFeatures, AuditEvent>()

const columns = col.columns([
  col.accessor("at", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="When" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-32", label: "When", skeleton: "w-20" },
  }),
  col.accessor("action", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Action"
        hint="Dotted verb, family.object.verb. The colour follows the last segment: red for rollbacks and revocations, green for promotions and approvals."
      />
    ),
    cell: ({ getValue }) => <ActionBadge action={getValue()} />,
    enableHiding: false,
    meta: { width: "w-56", label: "Action", skeleton: "w-40 rounded-full" },
  }),
  col.accessor("summary", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Summary" />
    ),
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <p
          className="flex items-center gap-1.5 truncate text-[13px]"
          title={row.original.summary}
        >
          <span className="truncate">{row.original.summary}</span>
          {sessionAuditIds.has(row.original.id) && (
            <StateBadge state="This session" size="sm" />
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {targetKindLabel(row.original.target.kind)} ·{" "}
          <span className="font-mono">{row.original.target.id}</span>
        </p>
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { width: "min-w-80 max-w-2xl", label: "Summary", skeleton: "w-72" },
  }),
  col.accessor((r) => r.actor.name, {
    id: "actor",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Actor" />
    ),
    cell: ({ row }) => <ActorChip actor={row.original.actor} />,
    meta: { width: "w-44", label: "Actor", skeleton: "w-28" },
  }),
  col.accessor("source", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ getValue }) => <SourceChip source={getValue()} />,
    meta: { width: "w-36", label: "Source", skeleton: "w-20" },
  }),
  col.accessor("id", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event" />
    ),
    cell: ({ getValue }) => <RecordLink number={getValue()} />,
    meta: { width: "w-28", label: "Event id", skeleton: "w-20" },
  }),
  col.accessor("hash", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Hash"
        hint="16-hex digest over prevHash, id, timestamp, action, target and summary. Each record chains onto the one before it."
      />
    ),
    cell: ({ getValue }) => <HashChip value={getValue()} />,
    enableSorting: false,
    meta: { width: "w-32", label: "Hash", skeleton: "w-24 rounded-full" },
  }),
])

function buildFacets(events: AuditEvent[]): FacetDef<AuditEvent>[] {
  return [
    {
      id: "source",
      title: "Source",
      options: auditSources.map((s) => ({
        value: s,
        label: auditSourceLabel[s],
      })),
      getValue: (r) => r.source,
    },
    {
      id: "actorKind",
      title: "Actor",
      options: auditActorKinds.map((k) => ({
        value: k,
        label: actorKindLabel[k],
      })),
      getValue: (r) => r.actor.kind,
    },
    {
      id: "family",
      title: "Action family",
      options: actionFamilies(events.map((e) => e.action)).map((f) => ({
        value: f,
        label: actionFamilyLabel(f),
      })),
      getValue: (r) => auditActionFamily(r.action),
    },
  ]
}

export function AuditTable({
  events,
  onOpen,
  toolbar,
  initialFacets,
  initialSearch,
}: {
  events: AuditEvent[]
  onOpen: (id: string) => void
  toolbar?: React.ReactNode
  initialFacets?: Record<string, string[]>
  /** Seeds the search box, e.g. a release id from `?q=`. */
  initialSearch?: string
}) {
  const facets = React.useMemo(() => buildFacets(events), [events])
  return (
    <DataTable
      columns={columns}
      data={events}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.id} ${r.action} ${r.summary} ${r.actor.name} ${r.target.id} ${r.target.label} ${r.context.agentId ?? ""} ${r.context.traceId ?? ""} ${r.context.releaseId ?? ""} ${r.context.approvalId ?? ""} ${r.hash}`
      }
      searchPlaceholder="Search actions, actors, targets, ids, hashes…"
      facets={facets}
      initialFacets={initialFacets}
      initialSearch={initialSearch}
      initialSorting={[{ id: "at", desc: true }]}
      initialColumnVisibility={{ hash: false }}
      onRowClick={(r) => onOpen(r.id)}
      totalLabel="events"
      caption="Audit events with action, summary, actor, source and hash, newest first"
      selectionLabel={(n) => (n === 1 ? "event" : "events")}
      emptyIcon={<FileClockIcon />}
      emptyTitle="No events in this window"
      emptyMessage="Widen the time range or clear a filter."
      toolbar={toolbar}
      density="compact"
    />
  )
}
