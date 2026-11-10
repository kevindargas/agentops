"use client"

import { useSearchParams } from "next/navigation"
import { CheckCircle2Icon, DownloadIcon, UserCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DataTable, type FacetDef } from "@/components/data-table"
import { incidentStates, priorityLabels } from "@/lib/constants"
import { groups, incidents } from "@/lib/data"
import { currentUser } from "@/lib/data/users"
import type { Incident, Priority } from "@/lib/types"
import { incidentColumns } from "./columns"

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

export function IncidentsTable({ data = incidents }: { data?: Incident[] }) {
  const params = useSearchParams()
  const view = params.get("view")
  const scoped =
    view === "major"
      ? data.filter((i) => i.majorIncident)
      : view === "mine"
        ? data.filter(
            (i) =>
              i.assignedToId === currentUser.id || i.callerId === currentUser.id
          )
        : data
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
      emptyTitle={
        view === "major"
          ? "No major incidents"
          : view === "mine"
            ? "Nothing assigned to you"
            : undefined
      }
      emptyMessage={
        view === "major"
          ? "All clear — no incidents are flagged as major right now."
          : view === "mine"
            ? "Incidents you open or are assigned will show up here."
            : undefined
      }
      selectionLabel={(n) => (n === 1 ? "incident" : "incidents")}
      toolbar={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast(
              "Export started — you will be notified when the file is ready"
            )
          }
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
              toast.success(
                `${rows.length} incident${rows.length === 1 ? "" : "s"} resolved`
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
