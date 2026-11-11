"use client"

import { setQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nextRun } from "@/lib/data/schedules"
import { NOW } from "@/lib/data/seed"
import { formatNumber, formatUntil } from "@/lib/format"
import { RunHistoryTable } from "./run-history-table"
import { ScheduleCalendar } from "./schedule-calendar"
import { SchedulesTable } from "./schedules-table"
import { runStore, scheduleStore, triggerStore } from "./store"
import { TriggersTable } from "./triggers-table"

import { isSchedulesTab, schedulesTabs, type SchedulesTab } from "./tabs"

export { isSchedulesTab, schedulesTabs, type SchedulesTab }

/**
 * Stat row computed from the client stores so pausing a schedule, queuing a
 * run or deleting a trigger moves the numbers immediately.
 */
function SchedulesStats() {
  const schedules = scheduleStore.use()
  const triggers = triggerStore.use()
  const runs = runStore.use()

  const since24 = new Date(NOW.getTime() - 86_400_000).toISOString()
  const active = schedules.filter((s) => s.enabled)
  const runs24 = runs.filter((r) => r.startedAt >= since24)
  const failed24 = runs24.filter((r) => r.status === "Failed")
  const next = active
    .map((s) => ({ s, at: nextRun(s.cron, NOW, s.timezone) }))
    .sort((a, b) => a.at.localeCompare(b.at))[0]
  const fired24 = triggers.reduce((acc, t) => acc + t.fired24h, 0)
  const erroring = triggers.filter((t) => t.status === "Error").length

  return (
    <StatGrid columns={5}>
      <StatCard
        label="Active schedules"
        value={active.length}
        hint={`${schedules.length - active.length} paused`}
      />
      <StatCard
        label="Runs · 24h"
        value={runs24.length}
        hint={`${runs24.filter((r) => r.source === "trigger").length} from triggers`}
      />
      <StatCard
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
        label="Next run"
        value={next ? formatUntil(next.at) : "None"}
        hint={next ? next.s.name : "Nothing scheduled"}
      />
      <StatCard
        label="Triggers fired · 24h"
        value={formatNumber(fired24)}
        hint={
          erroring
            ? `${erroring} trigger${erroring === 1 ? "" : "s"} in error`
            : `${triggers.filter((t) => t.status === "Active").length} active triggers`
        }
      />
    </StatGrid>
  )
}

/**
 * Tab shell for /agentops/schedules. The URL is the source of truth:
 * `SchedulesRoute` reads `?tab=`, `?agent=`, `?schedule=` and `?trigger=`
 * and passes them in; tab changes and sheet opens are written back with
 * `setQueryParam` (no navigation).
 */
export function SchedulesView({
  tab = "schedules",
  agentId,
  scheduleId,
  triggerId,
}: {
  /** `?tab=`, already validated with `isSchedulesTab`. */
  tab?: SchedulesTab
  /** `?agent=`: preselects the agent facet and narrows the calendar. */
  agentId?: string
  /** `?schedule=`: the schedule whose sheet is open. */
  scheduleId?: string
  /** `?trigger=`: the trigger whose sheet is open. */
  triggerId?: string
}) {
  const schedules = scheduleStore.use()
  const triggers = triggerStore.use()
  const runs = runStore.use()

  const counts: Record<SchedulesTab, number | null> = {
    schedules: schedules.length,
    triggers: triggers.length,
    calendar: null,
    runs: runs.length,
  }

  const trigger = (value: SchedulesTab, label: string) => (
    <TabsTrigger value={value}>
      {label}
      {counts[value] !== null && (
        <CountPill
          count={counts[value] ?? 0}
          tone={tab === value ? "inverse" : "muted"}
          className="ml-1"
        />
      )}
    </TabsTrigger>
  )

  return (
    <>
      <SchedulesStats />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (!isSchedulesTab(String(v))) return
          const next = v as SchedulesTab
          setQueryParam("tab", next === "schedules" ? null : next)
        }}
        className="gap-4"
      >
        <TabsList>
          {trigger("schedules", "Schedules")}
          {trigger("triggers", "Triggers")}
          {trigger("calendar", "Calendar")}
          {trigger("runs", "Run history")}
        </TabsList>
        {/* The agent facet is seeded once per `?agent=`; none of the panels
            write that param, so the keys only change on navigation. */}
        <TabsContent value="schedules">
          <SchedulesTable
            key={agentId ?? ""}
            initialAgentId={agentId}
            openId={scheduleId ?? null}
            onOpenChange={(id) => setQueryParam("schedule", id)}
          />
        </TabsContent>
        <TabsContent value="triggers">
          <TriggersTable
            key={agentId ?? ""}
            initialAgentId={agentId}
            openId={triggerId ?? null}
            onOpenChange={(id) => setQueryParam("trigger", id)}
          />
        </TabsContent>
        <TabsContent value="calendar">
          <ScheduleCalendar key={agentId ?? ""} initialAgentId={agentId} />
        </TabsContent>
        <TabsContent value="runs">
          <RunHistoryTable key={agentId ?? ""} initialAgentId={agentId} />
        </TabsContent>
      </Tabs>
    </>
  )
}
