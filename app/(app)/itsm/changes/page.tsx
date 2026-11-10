import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  CalendarDaysIcon,
  GitBranchIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ChangesTable } from "@/features/changes/changes-table"
import { changes, NOW } from "@/lib/data"

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
  return (
    <>
      <PageHeader
        title="Changes"
        description="Control the lifecycle of all changes with minimal disruption. Standard changes are pre-approved; normal changes go to the CAB; emergency changes are expedited."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/itsm/changes/calendar" />}
            >
              <CalendarDaysIcon /> Calendar
            </Button>
            <Button render={<Link href="/itsm/changes?new=1" />}>
              <PlusIcon /> New change
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active changes"
          value={active.length}
          icon={<GitBranchIcon />}
          hint={`${highRisk} high or very high risk`}
        />
        <StatCard
          label="Awaiting approval"
          value={awaiting}
          icon={<ShieldCheckIcon />}
          hint="Next CAB: Thursday 10:00"
        />
        <StatCard
          label="Scheduled this week"
          value={thisWeek}
          icon={<CalendarDaysIcon />}
          hint="Planned start within 7 days"
        />
        <StatCard
          label="Emergency"
          value={emergency}
          upIsGood={false}
          icon={emergency > 0 ? <ShieldAlertIcon /> : <ZapIcon />}
          hint="Expedited review path"
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ChangesTable />
      </Suspense>
    </>
  )
}
