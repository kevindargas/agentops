import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertOctagonIcon,
  BellOffIcon,
  BellRingIcon,
  FilterIcon,
  HeartPulseIcon,
  SlidersHorizontalIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { AlertsTable } from "@/features/itom/alerts-table"
import { alerts } from "@/lib/data"

export const metadata: Metadata = { title: "Alerts" }

export default function AlertsPage() {
  const open = alerts.filter((a) => a.state !== "Closed")
  const critical = open.filter((a) => a.severity === "Critical").length
  const unacked = open.filter((a) => !a.acknowledged).length
  const promoted = open.filter((a) => a.incidentNumber).length
  const events = open.reduce((a, x) => a + x.count, 0)
  return (
    <>
      <PageHeader
        title="Alerts"
        description="Events from monitoring tools are de-duplicated and correlated into alerts. Acknowledge, promote to an incident, or close noise."
        actions={
          <>
            <Button variant="outline" render={<Link href="/itom/health" />}>
              <HeartPulseIcon /> Service health
            </Button>
            <Button>
              <SlidersHorizontalIcon /> Correlation rules
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open alerts"
          value={open.length}
          upIsGood={false}
          delta={-14}
          icon={<BellRingIcon />}
          hint={`${promoted} promoted to incidents`}
        />
        <StatCard
          label="Critical"
          value={critical}
          upIsGood={false}
          icon={<AlertOctagonIcon />}
          hint="Require immediate action"
        />
        <StatCard
          label="Unacknowledged"
          value={unacked}
          upIsGood={false}
          icon={<BellOffIcon />}
          hint="Nobody has taken ownership yet"
        />
        <StatCard
          label="Noise reduction"
          value="96.2%"
          icon={<FilterIcon />}
          hint={`${events.toLocaleString("en-US")} events correlated into ${open.length} alerts`}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AlertsTable />
      </Suspense>
    </>
  )
}
