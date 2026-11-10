import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { HeartPulseIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AlertsStats } from "@/features/itom/alerts-stats"
import { AlertsTable } from "@/features/itom/alerts-table"
import { CorrelationRulesSheet } from "@/features/itom/correlation-rules-sheet"

export const metadata: Metadata = { title: "Alerts" }

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        nav="/itom/alerts"
        description="Events from monitoring tools are de-duplicated and correlated into alerts. Acknowledge, promote to an incident, or close noise."
        actions={
          <>
            <Button variant="outline" render={<Link href="/itom/health" />}>
              <HeartPulseIcon /> Service Health
            </Button>
            <CorrelationRulesSheet />
          </>
        }
      />
      <AlertsStats />
      <Suspense fallback={<TableSkeleton columns={6} />}>
        <AlertsTable />
      </Suspense>
    </>
  )
}
