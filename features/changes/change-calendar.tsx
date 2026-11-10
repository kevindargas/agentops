"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LockIcon,
  SnowflakeIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RiskBadge, StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { changes, getGroup, NOW } from "@/lib/data"
import { formatDate } from "@/lib/format"
import type { Change } from "@/lib/types"

type View = "month" | "week"

const typeClass: Record<Change["type"], { chip: string; dot: string }> = {
  Standard: {
    chip: "border-border bg-muted text-foreground hover:bg-muted/70",
    dot: "bg-muted-foreground/60",
  },
  Normal: {
    chip: "border-info/30 bg-info/10 text-info hover:bg-info/15",
    dot: "bg-info",
  },
  Emergency: {
    chip: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
    dot: "bg-destructive",
  },
}

/** Change freeze windows (UTC, inclusive). Deterministic so SSR and CSR agree. */
const freezeWindows = [
  {
    name: "Black Friday freeze",
    start: "2026-11-26",
    end: "2026-11-30",
    reason:
      "Peak retail traffic — only emergency changes with CAB chair approval.",
  },
  {
    name: "Year-end freeze",
    start: "2026-12-21",
    end: "2027-01-03",
    reason: "Financial close and reduced staffing.",
  },
]

const DAY = 86_400_000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const todayKey = dayKey(NOW)

function utcDate(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d))
}
function startOfWeek(d: Date) {
  const x = utcDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x
}
function freezeFor(key: string) {
  return freezeWindows.find((f) => key >= f.start && key <= f.end)
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

const active = changes.filter((c) => c.state !== "Canceled")
const byDay = active.reduce<Record<string, Change[]>>((acc, c) => {
  const k = c.plannedStart.slice(0, 10)
  ;(acc[k] ??= []).push(c)
  return acc
}, {})
Object.values(byDay).forEach((list) =>
  list.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
)

export function ChangeCalendar() {
  const [view, setView] = React.useState<View>("month")
  const [offset, setOffset] = React.useState(0)
  const [selected, setSelected] = React.useState(todayKey)

  const anchor = React.useMemo(() => {
    if (view === "month")
      return utcDate(NOW.getUTCFullYear(), NOW.getUTCMonth() + offset, 1)
    const s = startOfWeek(NOW)
    s.setUTCDate(s.getUTCDate() + offset * 7)
    return s
  }, [view, offset])

  const days = React.useMemo(() => {
    if (view === "week")
      return Array.from(
        { length: 7 },
        (_, i) => new Date(anchor.getTime() + i * DAY)
      )
    const first = startOfWeek(anchor)
    const lastOfMonth = utcDate(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() + 1,
      0
    )
    const weeks = Math.ceil((lastOfMonth.getTime() - first.getTime()) / DAY / 7)
    return Array.from(
      { length: weeks * 7 },
      (_, i) => new Date(first.getTime() + i * DAY)
    )
  }, [view, anchor])

  const rangeLabel =
    view === "month"
      ? anchor.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`

  const inRange = days.map(dayKey)
  const visibleChanges = active.filter((c) =>
    inRange.includes(c.plannedStart.slice(0, 10))
  )
  const frozenDays = inRange.filter((k) => freezeFor(k)).length
  const selectedChanges = byDay[selected] ?? []
  const selectedFreeze = freezeFor(selected)
  const selectedDate = new Date(`${selected}T00:00:00Z`)

  function go(delta: number) {
    setOffset((o) => o + delta)
  }
  function switchView(v: View) {
    setView(v)
    setOffset(0)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => go(-1)}
              aria-label={`Previous ${view}`}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => go(1)}
              aria-label={`Next ${view}`}
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOffset(0)
                setSelected(todayKey)
              }}
            >
              Today
            </Button>
            <h2 className="ml-1 text-sm font-semibold md:text-base">
              {rangeLabel}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {visibleChanges.length} change
              {visibleChanges.length === 1 ? "" : "s"}
              {frozenDays > 0
                ? ` · ${frozenDays} frozen day${frozenDays === 1 ? "" : "s"}`
                : ""}
            </span>
            <ToggleGroup
              multiple={false}
              value={[view]}
              onValueChange={(v) => v[0] && switchView(v[0] as View)}
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="month" size="sm" className="gap-1.5 px-3">
                <CalendarDaysIcon className="size-3.5" /> Month
              </ToggleGroupItem>
              <ToggleGroupItem value="week" size="sm" className="gap-1.5 px-3">
                <CalendarIcon className="size-3.5" /> Week
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div
            className={cn(
              "grid grid-cols-7 gap-px bg-border",
              view === "week"
                ? "auto-rows-[minmax(14rem,auto)]"
                : "auto-rows-[minmax(6.5rem,auto)]"
            )}
          >
            {days.map((d) => {
              const key = dayKey(d)
              const isToday = key === todayKey
              const isSelected = key === selected
              const outside =
                view === "month" && d.getUTCMonth() !== anchor.getUTCMonth()
              const freeze = freezeFor(key)
              const items = byDay[key] ?? []
              const max = view === "week" ? 6 : 3
              const shown = items.slice(0, max)
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${formatDate(key)}${items.length ? `, ${items.length} changes` : ""}${freeze ? `, ${freeze.name}` : ""}`}
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelected(key)
                    }
                  }}
                  className={cn(
                    "group relative flex min-w-0 flex-col gap-1 p-1.5 text-left transition-colors outline-none",
                    outside ? "bg-muted/30 text-muted-foreground" : "bg-card",
                    freeze &&
                      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--color-warning)_14%,transparent)_6px_12px)]",
                    isSelected
                      ? "ring-2 ring-brand/60 ring-inset"
                      : "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday
                          ? "bg-brand font-semibold text-brand-foreground"
                          : outside
                            ? "text-muted-foreground/60"
                            : ""
                      )}
                    >
                      {d.getUTCDate()}
                    </span>
                    {freeze && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="inline-flex items-center gap-0.5 rounded-sm bg-warning/20 px-1 py-0.5 text-[10px] font-medium text-warning-text" />
                          }
                        >
                          <LockIcon className="size-2.5" /> Freeze
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-56">
                          <p className="font-medium">{freeze.name}</p>
                          <p className="text-xs opacity-80">{freeze.reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {shown.map((c) => (
                      <Tooltip key={c.number}>
                        <TooltipTrigger
                          render={
                            <Link
                              href={`/itsm/changes/${c.number}`}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors",
                                typeClass[c.type].chip
                              )}
                            />
                          }
                        >
                          <span className="hidden shrink-0 font-mono text-[10px] opacity-70 sm:inline">
                            {time(c.plannedStart)}
                          </span>
                          <span className="truncate">{c.shortDescription}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-64">
                          <p className="font-mono text-[10px] opacity-70">
                            {c.number}
                          </p>
                          <p className="font-medium">{c.shortDescription}</p>
                          <p className="text-xs opacity-80">
                            {c.type} · {c.risk} risk · {time(c.plannedStart)}–
                            {time(c.plannedEnd)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {items.length > max && (
                      <span className="px-1 text-[11px] text-muted-foreground">
                        +{items.length - max} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {(["Standard", "Normal", "Emergency"] as Change["type"][]).map(
            (t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", typeClass[t].dot)} />{" "}
                {t}
              </span>
            )
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border bg-[repeating-linear-gradient(135deg,transparent_0_2px,color-mix(in_oklab,var(--color-warning)_45%,transparent)_2px_4px)]" />{" "}
            Freeze window
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-brand" /> Today
          </span>
          <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
            <SnowflakeIcon className="size-3" />{" "}
            {freezeWindows
              .map(
                (f) =>
                  `${f.name}: ${formatDate(f.start, { year: undefined })}–${formatDate(f.end, { year: undefined })}`
              )
              .join(" · ")}
          </span>
        </div>
      </div>

      <Card className="h-fit xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>
              {selected === todayKey
                ? "Today"
                : selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    timeZone: "UTC",
                  })}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatDate(selected)}
            </span>
          </CardTitle>
          <CardDescription>
            {selectedChanges.length === 0
              ? "No changes planned"
              : `${selectedChanges.length} change${selectedChanges.length === 1 ? "" : "s"} planned`}
            {selectedFreeze ? ` · ${selectedFreeze.name}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selectedFreeze && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
              <LockIcon className="mt-0.5 size-3.5 shrink-0 text-warning-text" />
              <div>
                <p className="font-medium">{selectedFreeze.name}</p>
                <p className="text-muted-foreground">{selectedFreeze.reason}</p>
              </div>
            </div>
          )}
          {selectedChanges.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center">
              <CalendarIcon className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Nothing scheduled</p>
              <p className="text-xs text-muted-foreground">
                {selectedFreeze
                  ? "Only emergency changes may be scheduled in a freeze."
                  : "A quiet day — a good window for low-risk standard changes."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y">
              {selectedChanges.map((c) => (
                <li key={c.number} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/itsm/changes/${c.number}`}
                    className="group flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          typeClass[c.type].dot
                        )}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.number}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <ClockIcon className="size-3" /> {time(c.plannedStart)}–
                        {time(c.plannedEnd)}
                      </span>
                    </div>
                    <p className="text-sm leading-snug font-medium group-hover:underline group-hover:underline-offset-4">
                      {c.shortDescription}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StateBadge state={c.state} dot={false} />
                      <RiskBadge risk={c.risk} />
                      <span className="text-xs text-muted-foreground">
                        {getGroup(c.assignmentGroupId)?.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <UserChip
                        userId={c.assignedToId}
                        size="xs"
                        className="[&_span]:text-xs"
                      />
                      <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        Open <ArrowRightIcon className="size-3" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
