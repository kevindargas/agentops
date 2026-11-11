"use client"

import { useSearchParams } from "next/navigation"

import { SchedulesView } from "./schedules-view"
import { isSchedulesTab, type SchedulesTab } from "./tabs"

/**
 * Client entry for /agentops/schedules. Reads `?tab=`, `?agent=`,
 * `?schedule=` and `?trigger=` through `useSearchParams` (the page wraps it
 * in `<Suspense>` with the table skeleton) so the server page stays static.
 * A deep link to a trigger lands on the Triggers tab unless `?tab=` names
 * another one.
 */
export function SchedulesRoute() {
  const params = useSearchParams()
  const tab = params.get("tab") ?? undefined
  const trigger = params.get("trigger") ?? undefined
  const activeTab: SchedulesTab = isSchedulesTab(tab)
    ? tab
    : trigger
      ? "triggers"
      : "schedules"

  return (
    <SchedulesView
      tab={activeTab}
      agentId={params.get("agent") ?? undefined}
      scheduleId={params.get("schedule") ?? undefined}
      triggerId={trigger}
    />
  )
}
