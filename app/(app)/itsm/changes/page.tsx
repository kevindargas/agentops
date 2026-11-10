import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { CalendarDaysIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { ChangesTable } from "@/features/changes/changes-table"
import { NewChangeSheet } from "@/features/changes/new-change-sheet"
import { cabSchedule } from "@/lib/constants"
import { changes, nextCab } from "@/lib/data/itsm"
import { NOW } from "@/lib/data/seed"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Changes" }

export default function ChangesPage() {
  const active = changes.filter(
    (c) => !["Closed", "Canceled"].includes(c.state)
  )
  const awaiting = changes.filter((c) => c.approval === "Requested").length
  const emergency = active.filter((c) => c.type === "Emergency").length
  const highRisk = active.filter(
    (c) => c.risk === "High" || c.risk === "Very High"
  ).length
  const thisWeek = changes.filter((c) => {
    const d = new Date(c.plannedStart).getTime()
    return d >= NOW.getTime() && d <= NOW.getTime() + 7 * 86_400_000
  }).length
  const cab = nextCab()
  return (
    <>
      <PageHeader
        nav="/itsm/changes"
        description="Control the lifecycle of all changes with minimal disruption. Standard changes are pre-approved; normal changes go to the CAB; emergency changes are expedited."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/itsm/changes/calendar" />}
            >
              <CalendarDaysIcon /> Calendar
            </Button>
            <Suspense fallback={<Skeleton className="h-8 w-32" />}>
              <NewChangeSheet />
            </Suspense>
          </>
        }
      />
      <StatGrid columns={4}>
        <StatCard
          label="Active changes"
          value={active.length}
          hint={`${highRisk} high or very high risk`}
        />
        <StatCard
          label="Awaiting approval"
          value={awaiting}
          hint={`Next CAB: ${cabSchedule.label} (${formatDate(cab.toISOString(), { year: undefined })})`}
        />
        <StatCard
          label="Scheduled this week"
          value={thisWeek}
          hint="Planned start within 7 days"
        />
        <StatCard
          label="Emergency"
          value={emergency}
          upIsGood={false}
          hint="Expedited review path"
        />
      </StatGrid>
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <ChangesTable />
      </Suspense>
    </>
  )
}
