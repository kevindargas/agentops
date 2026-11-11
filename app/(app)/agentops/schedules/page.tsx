import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { SchedulesRoute } from "@/features/agentops/schedules/schedules-route"

export const metadata: Metadata = { title: "Schedules & Triggers" }

/**
 * Static shell. `?tab=`, `?agent=`, `?schedule=` and `?trigger=` are read on
 * the client by `SchedulesRoute` inside the Suspense boundary, so this page
 * never touches `searchParams` and can be exported statically.
 */
export default function SchedulesPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/schedules"
        description="When and why agents run on their own: cron schedules with budgets and concurrency rules, event triggers from webhooks, queues and records, and the run history behind both."
      />
      <Suspense fallback={<TableSkeleton />}>
        <SchedulesRoute />
      </Suspense>
    </>
  )
}
