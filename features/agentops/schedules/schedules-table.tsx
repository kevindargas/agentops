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
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { setQueryParam } from "@/hooks/use-query-param"
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
import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { UserChip } from "@/components/shared/user-chip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import {
  describeCron,
  nextRun,
  timezones,
  type ConcurrencyPolicy,
  type Schedule,
} from "@/lib/data/schedules"
import { NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatCost, formatDurationMs, formatUntil } from "@/lib/format"
import { AgentChip } from "../shared"
import {
  AgentDot,
  Mono,
  RunStatusBadge,
  TargetPausedBadge,
  TraceLink,
} from "./shared"
import { runScheduleNow, toggleSchedule } from "./actions"
import { nextLocalId, runStore, scheduleStore } from "./store"

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
          <span className="flex min-w-0 flex-col gap-1">
            <TwoLineCell
              primary={row.original.name}
              secondary={row.original.description}
              className={cn(!row.original.enabled && "opacity-60")}
            />
            {row.original.enabled && (
              <TargetPausedBadge
                agentId={row.original.agentId}
                className="w-fit"
              />
            )}
          </span>
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
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Cron"
          hint="Five-field cron expression (minute, hour, day of month, month, weekday) evaluated in the schedule's timezone."
        />
      ),
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
            primary={<span className="tabular-nums">{formatUntil(v)}</span>}
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
            <DateCell value={lr.at} className="text-2xs" />
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
        <NumericCell
          value={getValue() || null}
          format={formatDurationMs}
          muted
        />
      ),
      meta: {
        width: "w-28",
        label: "Avg duration",
        numeric: true,
        skeleton: "w-12",
      },
    }),
    col.accessor("concurrency", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Concurrency"
          hint="What happens when an occurrence fires while the previous run is still active: Forbid skips it, Allow overlaps, Replace cancels the active run."
        />
      ),
      cell: ({ getValue }) => (
        <Badge
          variant="outline"
          className="text-2xs text-muted-foreground"
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
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Retry"
          hint="Attempts after a failed run and the backoff between them."
        />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue()}</span>
      ),
      enableSorting: false,
      meta: { width: "w-36", label: "Retry policy", skeleton: "w-20" },
    }),
    col.accessor("budgetPerRunUsd", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Budget / run"
          hint="Hard USD cap for one run. The run stops when the cap is reached."
        />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={(n) => formatCost(n, 2)} />
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
          aria-label={`${row.original.enabled ? "Pause" : "Resume"} ${row.original.name}`}
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

/* ------------------------------------------------------------------------ */
/* Table                                                                     */
/* ------------------------------------------------------------------------ */

export function SchedulesTable({
  agentId,
  initialAgentId,
  initialOpenId,
}: {
  /** Hard filter: hides the agent facet (agent record pages). */
  agentId?: string
  /** Preselects the agent facet (`?agent=` on the list page). */
  initialAgentId?: string
  /** Opens this schedule's sheet on load (`?schedule=`). */
  initialOpenId?: string
}) {
  const items = scheduleStore.use()
  const [openId, setOpenIdState] = React.useState<string | null>(() =>
    initialOpenId && scheduleStore.get().some((s) => s.id === initialOpenId)
      ? initialOpenId
      : null
  )
  const [editId, setEditId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const setOpenId = React.useCallback((id: string | null) => {
    setOpenIdState(id)
    setQueryParam("schedule", id)
  }, [])

  const columns = React.useMemo(() => buildColumns(toggleSchedule), [])

  const data = agentId ? items.filter((s) => s.agentId === agentId) : items
  const open = items.find((s) => s.id === openId) ?? null
  const editing = items.find((s) => s.id === editId) ?? null
  const deleting = items.find((s) => s.id === deleteId) ?? null

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
        initialFacets={
          initialAgentId && !agentId ? { agent: [initialAgentId] } : undefined
        }
        initialSorting={[{ id: "nextRun", desc: false }]}
        initialColumnVisibility={{
          retry: false,
          ownerId: false,
          timezone: false,
        }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="schedules"
        caption="Cron schedules with next run, last run and budget"
        selectionLabel={(n) => (n === 1 ? "schedule" : "schedules")}
        emptyTitle="No schedules"
        emptyMessage="Create a schedule to run an agent on a cadence."
        emptyIcon={<CalendarClockIcon />}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon /> New schedule
          </Button>
        }
      />
      <ScheduleSheet
        schedule={open}
        onClose={() => setOpenId(null)}
        onEdit={() => setEditId(openId)}
        onDelete={() => setDeleteId(openId)}
      />
      <EditScheduleSheet
        open={editing !== null}
        schedule={editing}
        defaultAgentId={initialAgentId ?? agentId}
        onClose={() => setEditId(null)}
        onSave={(next) => {
          scheduleStore.patch(next.id, next)
          setEditId(null)
          toast.success("Schedule saved", {
            description: `${next.name} · ${describeCron(next.cron)} (${next.timezone})`,
          })
        }}
      />
      <EditScheduleSheet
        open={createOpen}
        schedule={null}
        defaultAgentId={initialAgentId ?? agentId}
        onClose={() => setCreateOpen(false)}
        onSave={(next) => {
          scheduleStore.add(next, "start")
          setCreateOpen(false)
          toast.success("Schedule created", {
            description: `${next.name} · ${describeCron(next.cron)} (${next.timezone}) · first run ${formatUntil(nextRun(next.cron, NOW, next.timezone))}`,
          })
        }}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the schedule and its future occurrences from the calendar.
              Past runs stay in Run history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleting) return
                const removed = deleting
                scheduleStore.remove(removed.id)
                setDeleteId(null)
                setOpenId(null)
                toast("Schedule deleted", {
                  description: removed.name,
                  action: {
                    label: "Undo",
                    onClick: () => scheduleStore.add(removed, "start"),
                  },
                })
              }}
            >
              <Trash2Icon /> Delete schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

function ScheduleSheet({
  schedule: s,
  onClose,
  onEdit,
  onDelete,
}: {
  schedule: Schedule | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const runs = runStore.use()
  const recent = s ? runs.filter((r) => r.sourceId === s.id).slice(0, 8) : []
  return (
    <Sheet open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {s && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-2xs text-muted-foreground"
                >
                  {s.id}
                </Badge>
                {s.lastRun && (
                  <RunStatusBadge status={s.lastRun.status} size="sm" />
                )}
                {!s.enabled && (
                  <Badge
                    variant="outline"
                    className="text-2xs text-warning-text"
                  >
                    Paused
                  </Badge>
                )}
                {s.enabled && <TargetPausedBadge agentId={s.agentId} />}
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

            <SheetBody>
              <div className="flex flex-col gap-6">
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="Cadence"
                    value={<span className="font-mono text-sm">{s.cron}</span>}
                    hint={`${describeCron(s.cron)} · ${s.timezone}`}
                  />
                  <MetricTile
                    label="Next run"
                    value={
                      s.enabled
                        ? formatUntil(nextRun(s.cron, NOW, s.timezone))
                        : "Paused"
                    }
                    tone={s.enabled ? undefined : "muted"}
                    hint={
                      s.enabled ? (
                        <DateCell
                          value={nextRun(s.cron, NOW, s.timezone)}
                          mode="datetime"
                        />
                      ) : (
                        "Resume to put it back on the calendar"
                      )
                    }
                  />
                  <MetricTile
                    label="Budget / run"
                    value={formatCost(s.budgetPerRunUsd, 2)}
                    hint={`avg ${formatDurationMs(s.avgDurationMs)}`}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Run durations</h3>
                    <span className="text-xs text-muted-foreground">
                      last {s.history.length} runs
                    </span>
                  </div>
                  {s.history.length === 0 ? (
                    <EmptyState
                      size="sm"
                      title="No runs recorded"
                      description="The duration trend appears after the first completed run."
                    />
                  ) : (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <Sparkline
                        data={s.history.map((ms) => Math.round(ms / 1000))}
                        className="h-14 w-full"
                        color="var(--chart-1)"
                        baseline={Math.round(s.avgDurationMs / 1000)}
                      />
                      <p className="mt-1 text-2xs text-muted-foreground">
                        Seconds per run · hairline is the average
                      </p>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Recent runs</h3>
                  {recent.length === 0 ? (
                    <EmptyState
                      size="sm"
                      bare
                      title="No runs in the last 7 days"
                      description="Use Run now to start one outside the cadence."
                    />
                  ) : (
                    <ul className="divide-y rounded-lg border text-sm">
                      {recent.map((r) => (
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
                            {r.durationMs
                              ? formatDurationMs(r.durationMs)
                              : "running"}
                          </span>
                          <TraceLink traceId={r.traceId} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Parameters</h3>
                  {Object.keys(s.parameters).length === 0 ? (
                    <EmptyState
                      size="sm"
                      bare
                      title="No parameters"
                      description="The agent runs with its default configuration."
                    />
                  ) : (
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                      {JSON.stringify(s.parameters, null, 2)}
                    </pre>
                  )}
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
                      Silent: failures only appear in run history.
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
            </SheetBody>

            <SheetFooterActions
              tertiary={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger-text hover:text-danger-text"
                  onClick={onDelete}
                >
                  <Trash2Icon /> Delete
                </Button>
              }
              secondary={
                <>
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <PencilIcon /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSchedule(s.id, !s.enabled)}
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
                </>
              }
              primary={
                <Button size="sm" onClick={() => runScheduleNow(s)}>
                  <PlayIcon /> Run now
                </Button>
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* Edit / create sheet with cron builder                                     */
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

const agentItems = deployedAgents.map((a) => ({ value: a.id, label: a.name }))
const tzItems = timezones.map((t) => ({ value: t, label: t }))

interface CronDraft {
  frequency: Frequency
  interval: number
  hour: number
  minute: number
  weekday: string
  dayOfMonth: number
}

const defaultDraft: CronDraft = {
  frequency: "daily",
  interval: 15,
  hour: 9,
  minute: 0,
  weekday: "1",
  dayOfMonth: 1,
}

function draftFromCron(cron: string): CronDraft {
  const [m, h, dom, , dow] = cron.split(" ")
  const base = defaultDraft
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
  open,
  schedule,
  defaultAgentId,
  onClose,
  onSave,
}: {
  open: boolean
  /** Null creates a new schedule. */
  schedule: Schedule | null
  defaultAgentId?: string
  onClose: () => void
  onSave: (s: Schedule) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {open && (
          <EditScheduleForm
            key={schedule?.id ?? "new"}
            schedule={schedule}
            defaultAgentId={defaultAgentId}
            onSave={onSave}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function EditScheduleForm({
  schedule: s,
  defaultAgentId,
  onSave,
}: {
  schedule: Schedule | null
  defaultAgentId?: string
  onSave: (s: Schedule) => void
}) {
  const creating = s === null
  const [name, setName] = React.useState(s?.name ?? "")
  const [description, setDescription] = React.useState(s?.description ?? "")
  const [agentId, setAgentId] = React.useState(
    s?.agentId ??
      (defaultAgentId && getDeployedAgent(defaultAgentId)
        ? defaultAgentId
        : deployedAgents[0].id)
  )
  const [draft, setDraft] = React.useState<CronDraft>(() =>
    s ? draftFromCron(s.cron) : defaultDraft
  )
  const [timezone, setTimezone] = React.useState(s?.timezone ?? "UTC")
  const [concurrency, setConcurrency] = React.useState<ConcurrencyPolicy>(
    s?.concurrency ?? "Forbid"
  )
  const [budget, setBudget] = React.useState(
    s ? String(s.budgetPerRunUsd) : "5"
  )
  const cron = cronFromDraft(draft)
  const preview = describeCron(cron)
  const next = nextRun(cron, NOW, timezone)
  const valid = name.trim().length >= 3 && Number(budget) >= 0
  const formId = `schedule-form-${s?.id ?? "new"}`
  const set = <K extends keyof CronDraft>(k: K, v: CronDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))
  const clamp = (v: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Number(v) || min))

  return (
    <>
      <SheetHeader className="gap-1 border-b px-6 py-5">
        <SheetTitle>{creating ? "New schedule" : "Edit schedule"}</SheetTitle>
        <SheetDescription>
          {creating
            ? "Pick an agent, a cadence and a per-run budget. The schedule is enabled as soon as it is created."
            : "Changes apply to the next run. Runs already queued keep the old settings."}
        </SheetDescription>
      </SheetHeader>
      <form
        id={formId}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          const budgetPerRunUsd = Number(budget)
          if (s) {
            onSave({
              ...s,
              name: name.trim(),
              description: description.trim(),
              agentId,
              cron,
              timezone,
              concurrency,
              budgetPerRunUsd,
            })
            return
          }
          onSave({
            id: nextLocalId("sch"),
            name: name.trim(),
            description:
              description.trim() ||
              `${preview} on ${getDeployedAgent(agentId)?.name ?? agentId}.`,
            agentId,
            cron,
            timezone,
            enabled: true,
            avgDurationMs: 0,
            concurrency,
            retry: { attempts: 0, backoff: "none", delaySec: 0 },
            budgetPerRunUsd,
            ownerId: currentUser.id,
            parameters: {},
            notifications: {},
            history: [],
          })
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sch-name">Name</FieldLabel>
            <Input
              id="sch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nightly backlog triage"
              required
            />
          </Field>

          {creating && (
            <>
              <Field>
                <FieldLabel htmlFor="sch-description">Description</FieldLabel>
                <Input
                  id="sch-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What the run does and who reads the result"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sch-agent">Agent</FieldLabel>
                <Select
                  value={agentId}
                  onValueChange={(v) => v && setAgentId(String(v))}
                  items={agentItems}
                >
                  <SelectTrigger id="sch-agent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agentItems.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getDeployedAgent(agentId)?.paused && (
                  <FieldDescription className="text-warning-text">
                    This agent is paused. Runs are not accepted until it is
                    resumed.
                  </FieldDescription>
                )}
              </Field>
            </>
          )}

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              Next run {formatUntil(next)} ·{" "}
              <DateCell value={next} mode="datetime" />
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <SheetFooterActions
        primary={
          <Button type="submit" form={formId} disabled={!valid}>
            {creating ? (
              <>
                <PlusIcon /> Create schedule
              </>
            ) : (
              <>
                <SaveIcon /> Save schedule
              </>
            )}
          </Button>
        }
      />
    </>
  )
}
