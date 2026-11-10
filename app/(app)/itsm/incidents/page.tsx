import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  InboxIcon,
  TimerIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { IncidentsTable } from "@/features/incidents/incidents-table"
import { NewIncidentSheet } from "@/features/incidents/new-incident-sheet"
import { incidents } from "@/lib/data"
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
  return (
    <>
      <PageHeader
        title="Incidents"
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open"
          value={open.length}
          delta={-8}
          upIsGood={false}
          icon={<InboxIcon />}
          hint={`${majors} major · ${open.filter((i) => i.priority <= 2).length} high priority`}
        />
        <StatCard
          label="Unassigned"
          value={unassigned}
          icon={<AlertTriangleIcon />}
          hint="Awaiting triage by the Service Desk"
        />
        <StatCard
          label="SLA breached"
          value={breached}
          upIsGood={false}
          icon={<TimerIcon />}
          hint={`${formatPercent((slaMet / Math.max(1, resolved.length)) * 100)} compliance on resolved`}
        />
        <StatCard
          label="Critical (P1)"
          value={p1}
          upIsGood={false}
          icon={<AlertOctagonIcon />}
          hint="Major incident process may apply"
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <IncidentsTable />
      </Suspense>
    </>
  )
}
