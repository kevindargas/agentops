"use client"

import { useSearchParams } from "next/navigation"
import { CheckCircle2Icon, DownloadIcon, UserCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DataTable, type FacetDef } from "@/components/data-table"
import { incidentStates, priorityLabels } from "@/lib/constants"
import { getCi } from "@/lib/data/cmdb"
import { currentUser, getGroup, getUser, groups } from "@/lib/data/users"
import type { Incident, Priority } from "@/lib/types"
import {
  assignIncidentToMe,
  incidentColumns,
  resolveIncidents,
} from "./columns"
import { incidentsStore } from "./incidents-store"

const facets: FacetDef<Incident>[] = [
  {
    id: "state",
    title: "State",
    options: incidentStates.map((s) => ({ label: s, value: s })),
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
    id: "group",
    title: "Group",
    options: groups
      .filter((g) => g.type === "itil")
      .map((g) => ({ label: g.name, value: g.id })),
    getValue: (r) => r.assignmentGroupId,
  },
  {
    id: "channel",
    title: "Channel",
    options: [
      "Self-service",
      "Phone",
      "Email",
      "Chat",
      "Walk-in",
      "Monitoring",
    ].map((c) => ({ label: c, value: c })),
    getValue: (r) => r.channel,
  },
]

const csvEscape = (v: string | number | boolean | undefined) => {
  const s = v === undefined ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Builds and downloads a CSV of the given incidents (real Blob download). */
export function exportIncidentsCsv(rows: Incident[]) {
  const header = [
    "Number",
    "Short description",
    "Priority",
    "State",
    "Caller",
    "Assignment group",
    "Assigned to",
    "Affected service",
    "Channel",
    "Opened",
    "SLA due",
    "SLA breached",
  ]
  const lines = rows.map((i) =>
    [
      i.number,
      i.shortDescription,
      `P${i.priority}`,
      i.state,
      getUser(i.callerId)?.name,
      getGroup(i.assignmentGroupId)?.name,
      getUser(i.assignedToId)?.name,
      getCi(i.ciId)?.name,
      i.channel,
      i.opened,
      i.slaDue,
      i.slaBreached,
    ]
      .map(csvEscape)
      .join(",")
  )
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "incidents.csv"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Incident list. Reads `incidentsStore` so rows created by the New incident
 * sheet or changed by bulk actions render without a reload; pass `data` to
 * scope it to a precomputed list.
 */
export function IncidentsTable({ data }: { data?: Incident[] }) {
  const params = useSearchParams()
  const stored = incidentsStore.use()
  const source = data ?? stored
  const view = params.get("view")
  const scoped =
    view === "major"
      ? source.filter((i) => i.majorIncident)
      : view === "mine"
        ? source.filter(
            (i) =>
              i.assignedToId === currentUser.id || i.callerId === currentUser.id
          )
        : source
  const initialFacets =
    view === "open" ? { state: ["New", "In Progress", "On Hold"] } : undefined

  return (
    <DataTable
      key={view ?? "all"}
      columns={incidentColumns}
      data={scoped}
      getRowId={(r) => r.number}
      getSearchText={(r) =>
        `${r.number} ${r.shortDescription} ${r.category} ${r.subcategory}`
      }
      searchPlaceholder="Search incidents…"
      facets={facets}
      initialFacets={initialFacets}
      initialSorting={[{ id: "priority", desc: false }]}
      initialColumnVisibility={{
        caller: false,
        ci: false,
        channel: false,
        updated: false,
      }}
      rowHref={(r) => `/itsm/incidents/${r.number}`}
      totalLabel="incidents"
      caption="Incidents"
      emptyTitle={
        view === "major"
          ? "No major incidents"
          : view === "mine"
            ? "Nothing assigned to you"
            : undefined
      }
      emptyMessage={
        view === "major"
          ? "All clear. No incidents are flagged as major right now."
          : view === "mine"
            ? "Incidents you open or are assigned will show up here."
            : undefined
      }
      selectionLabel={(n) => (n === 1 ? "incident" : "incidents")}
      toolbar={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportIncidentsCsv(scoped)
            toast.success(
              `incidents.csv downloaded (${scoped.length} row${scoped.length === 1 ? "" : "s"})`
            )
          }}
        >
          <DownloadIcon /> Export
        </Button>
      }
      bulkActions={(rows, clear) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              assignIncidentToMe(rows.map((r) => r.original.number))
              toast.success(
                `${rows.length} incident${rows.length === 1 ? "" : "s"} assigned to you`
              )
              clear()
            }}
          >
            <UserCheckIcon /> Assign to me
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const open = rows
                .map((r) => r.original)
                .filter(
                  (i) => !["Resolved", "Closed", "Canceled"].includes(i.state)
                )
              resolveIncidents(open.map((i) => i.number))
              toast.success(
                `${open.length} incident${open.length === 1 ? "" : "s"} resolved`
              )
              clear()
            }}
          >
            <CheckCircle2Icon /> Resolve
          </Button>
        </>
      )}
    />
  )
}
