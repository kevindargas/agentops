import { Suspense } from "react"
import type { Metadata } from "next"

import { PeriodSelect } from "@/components/charts/period-select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AnalyticsView } from "@/features/workspace/analytics-view"

export const metadata: Metadata = { title: "Analytics" }

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        nav="/analytics"
        description="Performance across incident, change and request management. Figures cover the selected period unless noted."
        actions={
          <Suspense fallback={<Skeleton className="h-8 w-40 rounded-lg" />}>
            <PeriodSelect />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton toolbar={false} rows={10} />}>
        <AnalyticsView />
      </Suspense>
    </>
  )
}
