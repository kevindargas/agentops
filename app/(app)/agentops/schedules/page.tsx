import type { Metadata } from "next"
import { CalendarClockIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RunHistoryTable } from "@/features/agentops/schedules/run-history-table"
import { ScheduleCalendar } from "@/features/agentops/schedules/schedule-calendar"
import { SchedulesTable } from "@/features/agentops/schedules/schedules-table"
import { fmtUntil } from "@/features/agentops/schedules/format"
import { TriggersTable } from "@/features/agentops/schedules/triggers-table"
import { NOW } from "@/lib/data"
import {
  nextRun,
  scheduledRuns,
  schedules,
  triggers,
} from "@/lib/data/schedules"

export const metadata: Metadata = { title: "Schedules & triggers" }

const tabs = ["schedules", "triggers", "calendar", "runs"] as const

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const since24 = new Date(NOW.getTime() - 86_400_000).toISOString()
  const active = schedules.filter((s) => s.enabled)
  const runs24 = scheduledRuns.filter((r) => r.startedAt >= since24)
  const failed24 = runs24.filter((r) => r.status === "Failed")
  const nextRuns = active
    .map((s) => ({ s, at: nextRun(s.cron, NOW, s.timezone) }))
    .sort((a, b) => a.at.localeCompare(b.at))
  const next = nextRuns[0]
  const fired24 = triggers.reduce((acc, t) => acc + t.fired24h, 0)
  const erroring = triggers.filter((t) => t.status === "Error").length
  const defaultTab = tabs.includes(tab as (typeof tabs)[number])
    ? tab
    : "schedules"

  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<CalendarClockIcon />}
        title="Schedules & triggers"
        description="When and why agents run on their own: cron schedules with budgets and concurrency rules, event triggers from webhooks, queues and records, and the run history behind both."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          size="sm"
          label="Active schedules"
          value={active.length}
          hint={`${schedules.length - active.length} paused`}
        />
        <StatCard
          size="sm"
          label="Runs · 24h"
          value={runs24.length}
          hint={`${runs24.filter((r) => r.source === "trigger").length} from triggers`}
        />
        <StatCard
          size="sm"
          label="Failed · 24h"
          value={failed24.length}
          upIsGood={false}
          hint={
            failed24.length
              ? `${Math.round((failed24.length / Math.max(1, runs24.length)) * 100)}% of runs`
              : "No failures"
          }
          className={failed24.length ? "ring-destructive/20" : undefined}
        />
        <StatCard
          size="sm"
          label="Next run"
          value={next ? fmtUntil(next.at, NOW) : "—"}
          hint={next ? next.s.name : "Nothing scheduled"}
        />
        <StatCard
          size="sm"
          label="Triggers fired · 24h"
          value={fired24.toLocaleString()}
          hint={
            erroring
              ? `${erroring} trigger${erroring === 1 ? "" : "s"} in error`
              : `${triggers.filter((t) => t.status === "Active").length} active triggers`
          }
        />
      </div>

      <Tabs defaultValue={defaultTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="schedules">
            Schedules
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {schedules.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="triggers">
            Triggers
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {triggers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="runs">
            Run history
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {scheduledRuns.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="schedules">
          <SchedulesTable />
        </TabsContent>
        <TabsContent value="triggers">
          <TriggersTable />
        </TabsContent>
        <TabsContent value="calendar">
          <ScheduleCalendar />
        </TabsContent>
        <TabsContent value="runs">
          <RunHistoryTable />
        </TabsContent>
      </Tabs>
    </>
  )
}
