"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BellIcon,
  CalendarClockIcon,
  MailIcon,
  MessageCircleIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { DetailList } from "@/components/shared/detail-list"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { deployedAgents, getDeployedAgent, NOW } from "@/lib/data"
import {
  describeCron,
  nextRun,
  scheduledRuns,
  schedules as seed,
  timezones,
  type ConcurrencyPolicy,
  type Schedule,
} from "@/lib/data/schedules"
import { fmtCost } from "../format"
import { AgentChip } from "../shared"
import {
  AgentDot,
  Mono,
  RunStatusBadge,
  TraceLink,
  fmtRunDuration,
  fmtUntil,
} from "./shared"

const col = createColumnHelper<DataTableFeatures, Schedule>()

const concurrencyHint: Record<ConcurrencyPolicy, string> = {
  Forbid: "Skip if the previous run is still active",
  Allow: "Runs may overlap",
  Replace: "Cancel the active run and start fresh",
}

function retryLabel(s: Schedule) {
  if (s.retry.attempts === 0) return "No retries"
  return `${s.retry.attempts}× ${s.retry.backoff}${s.retry.delaySec ? ` · ${s.retry.delaySec}s` : ""}`
}

function buildColumns(onToggle: (id: string, on: boolean) => void) {
  return col.columns([
    col.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Schedule" />
      ),
      cell: ({ row }) => (
        <span className="flex items-start gap-2">
          <AgentDot agentId={row.original.agentId} className="mt-1.5" />
          <TwoLineCell
            primary={row.original.name}
            secondary={row.original.description}
            className={cn(!row.original.enabled && "opacity-60")}
          />
        </span>
      ),
      enableHiding: false,
      meta: { width: "min-w-64 max-w-sm", label: "Schedule", skeleton: "w-48" },
    }),
    col.accessor("agentId", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Agent" />
      ),
      cell: ({ getValue }) => <AgentChip agentId={getValue()} />,
      sortFn: (a, b) =>
        (getDeployedAgent(a.original.agentId)?.name ?? "").localeCompare(
          getDeployedAgent(b.original.agentId)?.name ?? ""
        ),
      meta: { width: "w-44", label: "Agent", skeleton: "w-28" },
    }),
    col.accessor("cron", {
      header: "Cron",
      cell: ({ row }) => (
        <TwoLineCell
          primary={
            <span className="font-mono text-xs">{row.original.cron}</span>
          }
          secondary={describeCron(row.original.cron)}
        />
      ),
      enableSorting: false,
      meta: { width: "w-48", label: "Cron", skeleton: "w-24" },
    }),
    col.accessor("timezone", {
      header: "Timezone",
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue()}</span>
      ),
      enableSorting: false,
      meta: { width: "w-36", label: "Timezone", skeleton: "w-20" },
    }),
    col.accessor((r) => (r.enabled ? nextRun(r.cron, NOW, r.timezone) : ""), {
      id: "nextRun",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Next run" />
      ),
      cell: ({ getValue, row }) => {
        const v = getValue()
        if (!row.original.enabled)
          return <span className="text-xs text-muted-foreground">Paused</span>
        return (
          <TwoLineCell
            primary={<span className="tabular-nums">{fmtUntil(v, NOW)}</span>}
            secondary={<DateCell value={v} mode="datetime" />}
          />
        )
      },
      sortFn: (a, b) => {
        const av = a.original.enabled
          ? nextRun(a.original.cron, NOW, a.original.timezone)
          : "9"
        const bv = b.original.enabled
          ? nextRun(b.original.cron, NOW, b.original.timezone)
          : "9"
        return av.localeCompare(bv)
      },
      meta: { width: "w-36", label: "Next run", skeleton: "w-20" },
    }),
    col.accessor((r) => r.lastRun?.status ?? "", {
      id: "lastRun",
      header: "Last run",
      cell: ({ row }) => {
        const lr = row.original.lastRun
        if (!lr)
          return <span className="text-xs text-muted-foreground">Never</span>
        return (
          <span className="flex flex-col gap-0.5">
            <RunStatusBadge status={lr.status} size="sm" />
            <DateCell value={lr.at} className="text-[11px]" />
          </span>
        )
      },
      enableSorting: false,
      meta: { width: "w-32", label: "Last run", skeleton: "w-20 rounded-full" },
    }),
    col.accessor("avgDurationMs", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Avg duration" />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={fmtRunDuration} muted />
      ),
      meta: {
        width: "w-28",
        label: "Avg duration",
        numeric: true,
        skeleton: "w-12",
      },
    }),
    col.accessor("concurrency", {
      header: "Concurrency",
      cell: ({ getValue }) => (
        <Badge
          variant="outline"
          className="text-[11px] text-muted-foreground"
          title={concurrencyHint[getValue()]}
        >
          {getValue()}
        </Badge>
      ),
      enableSorting: false,
      meta: { width: "w-28", label: "Concurrency", skeleton: "w-16" },
    }),
    col.accessor((r) => retryLabel(r), {
      id: "retry",
      header: "Retry",
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue()}</span>
      ),
      enableSorting: false,
      meta: { width: "w-36", label: "Retry policy", skeleton: "w-20" },
    }),
    col.accessor("budgetPerRunUsd", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Budget / run" />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={(n) => fmtCost(n, 2)} />
      ),
      meta: {
        width: "w-28",
        label: "Budget per run",
        numeric: true,
        skeleton: "w-12",
      },
    }),
    col.accessor("ownerId", {
      header: "Owner",
      cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
      enableSorting: false,
      meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
    }),
    col.accessor("enabled", {
      header: "Enabled",
      cell: ({ row }) => (
        <Switch
          size="sm"
          checked={row.original.enabled}
          onCheckedChange={(on) => onToggle(row.original.id, on)}
          aria-label={`${row.original.enabled ? "Disable" : "Enable"} ${row.original.name}`}
        />
      ),
      enableSorting: false,
      meta: { width: "w-20", label: "Enabled", skeleton: "w-8" },
    }),
  ])
}

const facets: FacetDef<Schedule>[] = [
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
  {
    id: "status",
    title: "Last run",
    options: ["Succeeded", "Failed", "Skipped", "Running"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.lastRun?.status ?? "",
  },
  {
    id: "enabled",
    title: "Enabled",
    options: [
      { value: "yes", label: "Enabled" },
      { value: "no", label: "Paused" },
    ],
    getValue: (r) => (r.enabled ? "yes" : "no"),
  },
]

export function SchedulesTable({ agentId }: { agentId?: string }) {
  const [items, setItems] = React.useState<Schedule[]>(seed)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [editId, setEditId] = React.useState<string | null>(null)

  const patch = React.useCallback(
    (id: string, p: Partial<Schedule>) =>
      setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s))),
    []
  )
  const toggle = React.useCallback(
    (id: string, on: boolean) => {
      patch(id, { enabled: on })
      const s = seed.find((x) => x.id === id)
      toast(on ? "Schedule enabled" : "Schedule paused", {
        description: s
          ? on
            ? `${s.name} next runs ${fmtUntil(nextRun(s.cron, NOW, s.timezone), NOW)}.`
            : `${s.name} will not run until re-enabled.`
          : undefined,
      })
    },
    [patch]
  )
  const columns = React.useMemo(() => buildColumns(toggle), [toggle])

  const data = agentId ? items.filter((s) => s.agentId === agentId) : items
  const open = items.find((s) => s.id === openId) ?? null
  const editing = items.find((s) => s.id === editId) ?? null

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.description} ${r.cron} ${describeCron(r.cron)} ${getDeployedAgent(r.agentId)?.name ?? ""}`
        }
        searchPlaceholder="Search schedules…"
        facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
        initialSorting={[{ id: "nextRun", desc: false }]}
        initialColumnVisibility={{
          retry: false,
          ownerId: false,
          timezone: false,
        }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="schedules"
        selectionLabel={(n) => (n === 1 ? "schedule" : "schedules")}
        emptyTitle="No schedules"
        emptyMessage="Create a schedule to run an agent on a cadence."
        emptyIcon={<CalendarClockIcon />}
        toolbar={
          <Button
            size="sm"
            onClick={() =>
              toast("New schedule", {
                description: "Pick an agent, a cadence and a budget.",
              })
            }
          >
            <PlusIcon /> New schedule
          </Button>
        }
      />
      <ScheduleSheet
        schedule={open}
        onClose={() => setOpenId(null)}
        onToggle={toggle}
        onEdit={() => {
          setEditId(openId)
        }}
      />
      <EditScheduleSheet
        schedule={editing}
        onClose={() => setEditId(null)}
        onSave={(p) => {
          if (editId) patch(editId, p)
          setEditId(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

function ScheduleSheet({
  schedule: s,
  onClose,
  onToggle,
  onEdit,
}: {
  schedule: Schedule | null
  onClose: () => void
  onToggle: (id: string, on: boolean) => void
  onEdit: () => void
}) {
  const runs = s
    ? scheduledRuns.filter((r) => r.sourceId === s.id).slice(0, 8)
    : []
  return (
    <Sheet open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {s && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  {s.id}
                </Badge>
                {s.lastRun && (
                  <RunStatusBadge status={s.lastRun.status} size="sm" />
                )}
                {!s.enabled && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-warning-text"
                  >
                    Paused
                  </Badge>
                )}
                <span className="ml-auto">
                  <AgentChip agentId={s.agentId} size="sm" />
                </span>
              </div>
              <SheetTitle className="text-lg leading-tight">
                {s.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed">
                {s.description}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Fact label="Cadence">
                    <span className="font-mono text-xs">{s.cron}</span>
                    <span className="block text-xs text-muted-foreground">
                      {describeCron(s.cron)} · {s.timezone}
                    </span>
                  </Fact>
                  <Fact label="Next run">
                    {s.enabled ? (
                      <>
                        <span className="tabular-nums">
                          {fmtUntil(nextRun(s.cron, NOW, s.timezone), NOW)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          <DateCell
                            value={nextRun(s.cron, NOW, s.timezone)}
                            mode="datetime"
                          />
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Paused</span>
                    )}
                  </Fact>
                  <Fact label="Budget / run">
                    <span className="tabular-nums">
                      {fmtCost(s.budgetPerRunUsd, 2)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      avg {fmtRunDuration(s.avgDurationMs)}
                    </span>
                  </Fact>
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Run durations</h3>
                    <span className="text-xs text-muted-foreground">
                      last 14 runs
                    </span>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <Sparkline
                      data={s.history.map((ms) => Math.round(ms / 1000))}
                      className="h-14 w-full"
                      color="var(--chart-1)"
                      baseline={Math.round(s.avgDurationMs / 1000)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Seconds per run · hairline is the average
                    </p>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Recent runs</h3>
                  {runs.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      No runs in the last 7 days.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border text-sm">
                      {runs.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <RunStatusBadge status={r.status} size="sm" />
                          <DateCell
                            value={r.startedAt}
                            mode="datetime"
                            tone="default"
                          />
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {fmtRunDuration(r.durationMs)}
                          </span>
                          <TraceLink traceId={r.traceId} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Parameters</h3>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(s.parameters, null, 2)}
                  </pre>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Policies</h3>
                  <DetailList
                    variant="rows"
                    dense
                    items={[
                      {
                        label: "Concurrency",
                        value: s.concurrency,
                        hint: concurrencyHint[s.concurrency],
                      },
                      { label: "Retry", value: retryLabel(s) },
                      {
                        label: "Owner",
                        value: <UserChip userId={s.ownerId} size="xs" />,
                      },
                    ]}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {!s.notifications.slack &&
                  !s.notifications.email?.length &&
                  !s.notifications.pagerduty ? (
                    <p className="text-xs text-muted-foreground">
                      Silent — failures only appear in run history.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {s.notifications.slack && (
                        <li className="flex items-center gap-2">
                          <MessageCircleIcon className="size-3.5 text-muted-foreground" />
                          <Mono>{s.notifications.slack}</Mono>
                          <span className="text-xs text-muted-foreground">
                            on failure and budget overrun
                          </span>
                        </li>
                      )}
                      {s.notifications.email?.map((e) => (
                        <li key={e} className="flex items-center gap-2">
                          <MailIcon className="size-3.5 text-muted-foreground" />
                          <Mono>{e}</Mono>
                          <span className="text-xs text-muted-foreground">
                            summary after each run
                          </span>
                        </li>
                      ))}
                      {s.notifications.pagerduty && (
                        <li className="flex items-center gap-2">
                          <BellIcon className="size-3.5 text-muted-foreground" />
                          <Mono>{s.notifications.pagerduty}</Mono>
                          <span className="text-xs text-muted-foreground">
                            page on 2 consecutive failures
                          </span>
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              </div>
            </div>

            <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <PencilIcon /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(s.id, !s.enabled)}
              >
                {s.enabled ? (
                  <>
                    <PauseIcon /> Pause
                  </>
                ) : (
                  <>
                    <PlayIcon /> Resume
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  toast.success("Run queued", {
                    description: `${s.name} starts within a minute on ${getDeployedAgent(s.agentId)?.name}.`,
                  })
                }
              >
                <PlayIcon /> Run now
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* Edit sheet with cron builder                                              */
/* ------------------------------------------------------------------------ */

type Frequency =
  "minutes" | "hourly" | "daily" | "weekdays" | "weekly" | "monthly"

const frequencyItems: { value: Frequency; label: string }[] = [
  { value: "minutes", label: "Every N minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

const weekdayItems = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
]

const concurrencyItems = (
  ["Forbid", "Allow", "Replace"] as ConcurrencyPolicy[]
).map((c) => ({ value: c, label: c }))

interface CronDraft {
  frequency: Frequency
  interval: number
  hour: number
  minute: number
  weekday: string
  dayOfMonth: number
}

function draftFromCron(cron: string): CronDraft {
  const [m, h, dom, , dow] = cron.split(" ")
  const base: CronDraft = {
    frequency: "daily",
    interval: 15,
    hour: 9,
    minute: 0,
    weekday: "1",
    dayOfMonth: 1,
  }
  if (m.startsWith("*/"))
    return { ...base, frequency: "minutes", interval: Number(m.slice(2)) }
  const minute = Number(m) || 0
  if (h === "*") return { ...base, frequency: "hourly", minute }
  const hour = Number(h.split(",")[0]) || 0
  if (dom !== "*")
    return {
      ...base,
      frequency: "monthly",
      hour,
      minute,
      dayOfMonth: Number(dom),
    }
  if (dow === "1-5") return { ...base, frequency: "weekdays", hour, minute }
  if (dow !== "*")
    return {
      ...base,
      frequency: "weekly",
      hour,
      minute,
      weekday: dow.split(",")[0],
    }
  return { ...base, hour, minute }
}

function cronFromDraft(d: CronDraft) {
  switch (d.frequency) {
    case "minutes":
      return `*/${d.interval} * * * *`
    case "hourly":
      return `${d.minute} * * * *`
    case "daily":
      return `${d.minute} ${d.hour} * * *`
    case "weekdays":
      return `${d.minute} ${d.hour} * * 1-5`
    case "weekly":
      return `${d.minute} ${d.hour} * * ${d.weekday}`
    case "monthly":
      return `${d.minute} ${d.hour} ${d.dayOfMonth} * *`
  }
}

function EditScheduleSheet({
  schedule,
  onClose,
  onSave,
}: {
  schedule: Schedule | null
  onClose: () => void
  onSave: (p: Partial<Schedule>) => void
}) {
  return (
    <Sheet open={schedule !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {schedule && (
          <EditScheduleForm
            key={schedule.id}
            schedule={schedule}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function EditScheduleForm({
  schedule: s,
  onClose,
  onSave,
}: {
  schedule: Schedule
  onClose: () => void
  onSave: (p: Partial<Schedule>) => void
}) {
  const [name, setName] = React.useState(s.name)
  const [draft, setDraft] = React.useState<CronDraft>(() =>
    draftFromCron(s.cron)
  )
  const [timezone, setTimezone] = React.useState(s.timezone)
  const [concurrency, setConcurrency] = React.useState<ConcurrencyPolicy>(
    s.concurrency
  )
  const [budget, setBudget] = React.useState(String(s.budgetPerRunUsd))
  const cron = cronFromDraft(draft)
  const preview = describeCron(cron)
  const next = nextRun(cron, NOW, timezone)
  const tzItems = timezones.map((t) => ({ value: t, label: t }))
  const set = <K extends keyof CronDraft>(k: K, v: CronDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))
  const clamp = (v: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Number(v) || min))

  return (
    <>
      <SheetHeader className="gap-1 border-b px-6 py-5">
        <SheetTitle>Edit schedule</SheetTitle>
        <SheetDescription>
          Changes apply to the next run. Runs already queued keep the old
          settings.
        </SheetDescription>
      </SheetHeader>
      <form
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            name,
            cron,
            timezone,
            concurrency,
            budgetPerRunUsd: Number(budget) || s.budgetPerRunUsd,
          })
          toast.success("Schedule saved", {
            description: `${name} · ${preview} (${timezone})`,
          })
        }}
        id={`edit-${s.id}`}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sch-name">Name</FieldLabel>
            <Input
              id="sch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sch-frequency">Frequency</FieldLabel>
            <Select
              value={draft.frequency}
              onValueChange={(v) => v && set("frequency", v as Frequency)}
              items={frequencyItems}
            >
              <SelectTrigger id="sch-frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyItems.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {draft.frequency === "minutes" && (
              <Field>
                <FieldLabel htmlFor="sch-interval">Every (minutes)</FieldLabel>
                <Input
                  id="sch-interval"
                  type="number"
                  min={1}
                  max={59}
                  value={draft.interval}
                  onChange={(e) =>
                    set("interval", clamp(e.target.value, 1, 59))
                  }
                />
              </Field>
            )}
            {draft.frequency !== "minutes" && draft.frequency !== "hourly" && (
              <Field>
                <FieldLabel htmlFor="sch-hour">Hour</FieldLabel>
                <Input
                  id="sch-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={draft.hour}
                  onChange={(e) => set("hour", clamp(e.target.value, 0, 23))}
                />
              </Field>
            )}
            {draft.frequency !== "minutes" && (
              <Field>
                <FieldLabel htmlFor="sch-minute">Minute</FieldLabel>
                <Input
                  id="sch-minute"
                  type="number"
                  min={0}
                  max={59}
                  value={draft.minute}
                  onChange={(e) => set("minute", clamp(e.target.value, 0, 59))}
                />
              </Field>
            )}
            {draft.frequency === "weekly" && (
              <Field>
                <FieldLabel htmlFor="sch-weekday">Weekday</FieldLabel>
                <Select
                  value={draft.weekday}
                  onValueChange={(v) => v && set("weekday", v)}
                  items={weekdayItems}
                >
                  <SelectTrigger id="sch-weekday" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekdayItems.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {draft.frequency === "monthly" && (
              <Field>
                <FieldLabel htmlFor="sch-dom">Day of month</FieldLabel>
                <Input
                  id="sch-dom"
                  type="number"
                  min={1}
                  max={28}
                  value={draft.dayOfMonth}
                  onChange={(e) =>
                    set("dayOfMonth", clamp(e.target.value, 1, 28))
                  }
                />
              </Field>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="sch-tz">Timezone</FieldLabel>
            <Select
              value={timezone}
              onValueChange={(v) => v && setTimezone(v)}
              items={tzItems}
            >
              <SelectTrigger id="sch-tz" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tzItems.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{cron}</span>
              <span className="text-xs text-muted-foreground">{preview}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Next run {fmtUntil(next, NOW)} ·{" "}
              <DateCell value={next} mode="datetime" />
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="sch-concurrency">Concurrency</FieldLabel>
              <Select
                value={concurrency}
                onValueChange={(v) =>
                  v && setConcurrency(v as ConcurrencyPolicy)
                }
                items={concurrencyItems}
              >
                <SelectTrigger id="sch-concurrency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {concurrencyItems.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {concurrencyHint[concurrency]}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="sch-budget">Budget per run (USD)</FieldLabel>
              <Input
                id="sch-budget"
                type="number"
                min={0}
                step="0.5"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <FieldDescription>
                Runs stop when the cap is hit.
              </FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </form>
      <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" form={`edit-${s.id}`}>
          <SaveIcon /> Save schedule
        </Button>
      </SheetFooter>
    </>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
