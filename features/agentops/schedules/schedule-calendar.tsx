"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LockIcon,
  PlayIcon,
  WrenchIcon,
} from "lucide-react"

import { Section } from "@/components/shared/page-header"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import { changeFreezeWindows } from "@/lib/data/itsm"
import {
  describeCron,
  freezeWindows,
  occurrences,
  type FreezeWindow,
  type Schedule,
} from "@/lib/data/schedules"
import { NOW } from "@/lib/data/seed"
import { formatClock, formatDurationMs } from "@/lib/format"
import { AgentChip } from "../shared"
import { runScheduleNow } from "./actions"
import { AgentDot, agentColor } from "./shared"
import { scheduleStore } from "./store"

const DAY = 86_400_000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const todayKey = dayKey(NOW)

/**
 * Change freezes come from the change calendar (lib/data/itsm.ts); the
 * scheduler's `freezeWindows` derives its deploy freezes from that list and
 * adds provider maintenance windows. The ids tell the two kinds apart.
 */
const changeFreezeIds = new Set(changeFreezeWindows.map((w) => w.id))
const freezeKind = (f: FreezeWindow) =>
  changeFreezeIds.has(f.id) ? "Change freeze" : "Maintenance window"

function startOfWeek(d: Date) {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  )
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x
}

interface DayGroup {
  schedule: Schedule
  times: string[]
}

/** Freeze windows overlapping a UTC calendar day. */
function freezesFor(key: string) {
  const start = `${key}T00:00:00.000Z`
  const end = new Date(new Date(start).getTime() + DAY).toISOString()
  return freezeWindows.filter((f) => f.start < end && f.end > start)
}

const shortDate = (d: Date, year = false) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  })

export function ScheduleCalendar({
  initialAgentId,
}: {
  /** Shows only this agent's chips at first (`?agent=`); the legend can re-enable the rest. */
  initialAgentId?: string
}) {
  const schedules = scheduleStore.use()
  const [offset, setOffset] = React.useState(0)
  const [hidden, setHidden] = React.useState<Set<string>>(
    () =>
      new Set(
        initialAgentId && getDeployedAgent(initialAgentId)
          ? deployedAgents
              .filter((a) => a.id !== initialAgentId)
              .map((a) => a.id)
          : []
      )
  )

  const weekStart = React.useMemo(() => {
    const s = startOfWeek(NOW)
    s.setUTCDate(s.getUTCDate() + offset * 7)
    return s
  }, [offset])
  const days = React.useMemo(
    () =>
      Array.from(
        { length: 7 },
        (_, i) => new Date(weekStart.getTime() + i * DAY)
      ),
    [weekStart]
  )

  // Every schedule occurrence inside the visible week, grouped per day and schedule.
  const byDay = React.useMemo(() => {
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY)
    const from = new Date(weekStart.getTime() - 60_000)
    const map: Record<string, DayGroup[]> = {}
    for (const s of schedules) {
      if (!s.enabled) continue
      const occ = occurrences(s.cron, from, weekEnd, s.timezone, 7 * 96)
      const perDay: Record<string, string[]> = {}
      for (const iso of occ) (perDay[iso.slice(0, 10)] ??= []).push(iso)
      for (const [key, times] of Object.entries(perDay))
        (map[key] ??= []).push({ schedule: s, times })
    }
    for (const list of Object.values(map))
      list.sort((a, b) => a.times[0].localeCompare(b.times[0]))
    return map
  }, [weekStart, schedules])

  const rangeLabel = `${shortDate(days[0])} to ${shortDate(days[6], true)}`
  const totalRuns = days.reduce(
    (acc, d) =>
      acc +
      (byDay[dayKey(d)] ?? [])
        .filter((g) => !hidden.has(g.schedule.agentId))
        .reduce((a, g) => a + g.times.length, 0),
    0
  )
  const weekFreezes = freezeWindows.filter(
    (f) =>
      f.start < new Date(weekStart.getTime() + 7 * DAY).toISOString() &&
      f.end > weekStart.toISOString()
  )
  const agentsInView = deployedAgents.filter((a) =>
    days.some((d) =>
      (byDay[dayKey(d)] ?? []).some((g) => g.schedule.agentId === a.id)
    )
  )

  return (
    <Section
      title={rangeLabel}
      description={`${totalRuns.toLocaleString()} scheduled run${totalRuns === 1 ? "" : "s"}${
        weekFreezes.length > 0
          ? ` · ${weekFreezes.length} freeze window${weekFreezes.length === 1 ? "" : "s"}`
          : ""
      } · Monday to Sunday, UTC`}
      actions={
        <>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous week"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Next week"
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
          >
            This week
          </Button>
        </>
      }
      className="min-w-0"
    >
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid min-w-[56rem] grid-cols-7 border-b bg-muted/40 text-center text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          {days.map((d) => {
            const key = dayKey(d)
            return (
              <div
                key={key}
                className="flex items-center justify-center gap-1.5 py-2"
              >
                {d.toLocaleDateString("en-US", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full tabular-nums",
                    key === todayKey &&
                      "bg-brand font-semibold text-brand-foreground"
                  )}
                >
                  {d.getUTCDate()}
                </span>
              </div>
            )
          })}
        </div>
        <div className="grid min-w-[56rem] auto-rows-[minmax(18rem,auto)] grid-cols-7 gap-px bg-border">
          {days.map((d) => {
            const key = dayKey(d)
            const freezes = freezesFor(key)
            const groups = (byDay[key] ?? []).filter(
              (g) => !hidden.has(g.schedule.agentId)
            )
            const isToday = key === todayKey
            return (
              <div
                key={key}
                className={cn(
                  "relative flex min-w-0 flex-col gap-1 bg-card p-1.5",
                  isToday && "bg-brand/[0.03]",
                  freezes.length > 0 &&
                    "bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--color-warning)_14%,transparent)_6px_12px)]"
                )}
              >
                {freezes.map((f) => (
                  <FreezeChip key={f.id} freeze={f} dayKey={key} />
                ))}
                {groups.length === 0 && freezes.length === 0 && (
                  <p className="px-1 pt-4 text-center text-2xs text-muted-foreground">
                    No runs
                  </p>
                )}
                {groups.map((g) => (
                  <RunChip key={g.schedule.id} group={g} frozen={freezes} />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium">Agents</span>
        {agentsInView.map((a) => {
          const off = hidden.has(a.id)
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((s) => {
                  const next = new Set(s)
                  if (next.has(a.id)) next.delete(a.id)
                  else next.add(a.id)
                  return next
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted",
                off && "line-through opacity-50"
              )}
            >
              <AgentDot agentId={a.id} className="size-2.5 rounded-sm" />
              {a.name}
            </button>
          )
        })}
        <span className="inline-flex items-center gap-1.5">
          <LockIcon className="size-3 text-warning-text" />
          Change freeze (from the change calendar)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <WrenchIcon className="size-3 text-warning-text" />
          Maintenance window
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand" /> Today
        </span>
      </div>
    </Section>
  )
}

function FreezeChip({
  freeze,
  dayKey: key,
}: {
  freeze: FreezeWindow
  dayKey: string
}) {
  const dayStart = `${key}T00:00:00.000Z`
  const dayEnd = new Date(new Date(dayStart).getTime() + DAY).toISOString()
  const startsToday = freeze.start >= dayStart
  const endsToday = freeze.end <= dayEnd
  const span =
    startsToday && endsToday
      ? `${formatClock(freeze.start)} to ${formatClock(freeze.end)}`
      : startsToday
        ? `from ${formatClock(freeze.start)}`
        : endsToday
          ? `until ${formatClock(freeze.end)}`
          : "all day"
  const kind = freezeKind(freeze)
  const Icon = kind === "Change freeze" ? LockIcon : WrenchIcon
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="flex min-w-0 items-center gap-1 rounded-md border border-warning/40 bg-warning/15 px-1.5 py-1 text-left text-2xs leading-tight font-medium text-warning-text" />
        }
      >
        <Icon className="size-3 shrink-0" aria-label={kind} />
        <span className="truncate">{freeze.name}</span>
        <span className="ml-auto shrink-0 font-mono text-3xs font-normal opacity-80">
          {span}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        <p className="font-medium">{freeze.name}</p>
        <p className="text-xs opacity-80">{kind}</p>
        <p className="text-xs opacity-80">{freeze.scope}</p>
        <p className="text-xs opacity-80">{freeze.reason}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function RunChip({
  group,
  frozen,
}: {
  group: DayGroup
  frozen: FreezeWindow[]
}) {
  const { schedule: s, times } = group
  const skipped = times.filter((t) =>
    frozen.some((f) => t >= f.start && t < f.end)
  ).length
  const color = agentColor(s.agentId)
  const label =
    times.length <= 2 ? times.map(formatClock).join(", ") : `×${times.length}`
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-2xs leading-tight transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={{
              borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
              background: `color-mix(in oklab, ${color} 10%, transparent)`,
            }}
          />
        }
      >
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <span className="truncate">{s.name}</span>
        <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground tabular-nums">
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <PopoverHeader className="gap-1">
          <PopoverTitle className="flex items-center gap-2 text-sm">
            <AgentDot agentId={s.agentId} />
            {s.name}
          </PopoverTitle>
          <PopoverDescription className="text-xs">
            {s.description}
          </PopoverDescription>
        </PopoverHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Agent</dt>
          <dd>
            <AgentChip agentId={s.agentId} size="sm" />
          </dd>
          <dt className="text-muted-foreground">Cadence</dt>
          <dd>
            <span className="font-mono">{s.cron}</span>
            <span className="block text-muted-foreground">
              {describeCron(s.cron)} · {s.timezone}
            </span>
          </dd>
          <dt className="text-muted-foreground">Runs</dt>
          <dd className="tabular-nums">
            {times.length <= 6 ? (
              <span className="flex flex-wrap gap-1">
                {times.map((t) => {
                  const inFreeze = frozen.some((f) => t >= f.start && t < f.end)
                  return (
                    <span
                      key={t}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm bg-muted px-1 py-0.5 font-mono",
                        inFreeze && "text-warning-text line-through"
                      )}
                    >
                      <ClockIcon className="size-2.5" />
                      {formatClock(t)}
                    </span>
                  )
                })}
              </span>
            ) : (
              <>
                {times.length} runs · {formatClock(times[0])} to{" "}
                {formatClock(times[times.length - 1])}
                {skipped > 0 && (
                  <span className="block text-warning-text">
                    {skipped} skipped inside a freeze window
                  </span>
                )}
              </>
            )}
          </dd>
          <dt className="text-muted-foreground">Avg duration</dt>
          <dd className="tabular-nums">
            {s.avgDurationMs
              ? formatDurationMs(s.avgDurationMs)
              : "No runs yet"}
          </dd>
          <dt className="text-muted-foreground">Owner</dt>
          <dd>
            <UserChip userId={s.ownerId} size="xs" />
          </dd>
        </dl>
        <div className="flex items-center justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => runScheduleNow(s)}>
            <PlayIcon /> Run now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
