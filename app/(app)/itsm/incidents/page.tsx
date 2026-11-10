import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { IncidentsTable } from "@/features/incidents/incidents-table"
import { NewIncidentSheet } from "@/features/incidents/new-incident-sheet"
import { incidents } from "@/lib/data/itsm"
import { openIncidentDelta } from "@/lib/data/metrics"
import { formatPercent } from "@/lib/format"

export const metadata: Metadata = { title: "Incidents" }

export default function IncidentsPage() {
  const open = incidents.filter(
    (i) => !["Resolved", "Closed", "Canceled"].includes(i.state)
  )
  const unassigned = open.filter((i) => !i.assignedToId).length
  const breached = open.filter((i) => i.slaBreached).length
  const p1 = open.filter((i) => i.priority === 1).length
  const majors = open.filter((i) => i.majorIncident).length
  const resolved = incidents.filter((i) => i.resolved)
  const slaMet = resolved.filter((i) => !i.slaBreached).length
  const openDelta = openIncidentDelta(14)
  return (
    <>
      <PageHeader
        nav="/itsm/incidents"
        description="Unplanned interruptions or reductions in quality of an IT service. Restore service as quickly as possible and keep callers informed."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/itsm/incidents?view=major" />}
            >
              Major incidents
            </Button>
            <Suspense fallback={<Skeleton className="h-8 w-32" />}>
              <NewIncidentSheet />
            </Suspense>
          </>
        }
      />
      <StatGrid columns={4}>
        <StatCard
          label="Open"
          value={open.length}
          delta={openDelta.delta}
          deltaUnit=""
          deltaLabel="vs 14 days ago"
          upIsGood={false}
          hint={`${majors} major · ${open.filter((i) => i.priority <= 2).length} high priority`}
        />
        <StatCard
          label="Unassigned"
          value={unassigned}
          hint="Awaiting triage by the Service Desk"
        />
        <StatCard
          label="SLA breached"
          value={breached}
          upIsGood={false}
          hint={`${formatPercent((slaMet / Math.max(1, resolved.length)) * 100)} compliance on resolved`}
        />
        <StatCard
          label="Critical (P1)"
          value={p1}
          upIsGood={false}
          hint="Major incident process may apply"
        />
      </StatGrid>
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <IncidentsTable />
      </Suspense>
    </>
  )
}
