import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { SchedulesView } from "@/features/agentops/schedules/schedules-view"
import {
  isSchedulesTab,
  type SchedulesTab,
} from "@/features/agentops/schedules/tabs"

export const metadata: Metadata = { title: "Schedules & Triggers" }

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    agent?: string
    schedule?: string
    trigger?: string
  }>
}) {
  const { tab, agent, schedule, trigger } = await searchParams
  // A deep link to a record lands on its tab unless the URL names another one.
  const initialTab: SchedulesTab = isSchedulesTab(tab)
    ? tab
    : trigger
      ? "triggers"
      : "schedules"

  return (
    <>
      <PageHeader
        nav="/agentops/schedules"
        description="When and why agents run on their own: cron schedules with budgets and concurrency rules, event triggers from webhooks, queues and records, and the run history behind both."
      />
      <SchedulesView
        initialTab={initialTab}
        agentId={agent}
        scheduleId={schedule}
        triggerId={trigger}
      />
    </>
  )
}
