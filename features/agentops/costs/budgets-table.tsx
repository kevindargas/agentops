"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BellIcon,
  CheckIcon,
  GaugeIcon,
  PauseCircleIcon,
  PlusIcon,
  TrendingDownIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AvailabilityBar } from "@/components/charts/availability-bar"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { Eyebrow } from "@/components/shared/eyebrow"
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
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { deployedAgents } from "@/lib/data/agentops"
import {
  costDaily,
  spendTodayByAgent,
  type Budget,
  type BudgetAction,
  type BudgetPeriod,
  type BudgetScopeKind,
  type BudgetStatus,
} from "@/lib/data/costs"
import { NOW } from "@/lib/data/seed"
import { currentUser, getUser } from "@/lib/data/users"
import { formatCurrency } from "@/lib/format"
import { GatewayBadge } from "../providers/shared"
import { AgentChip } from "../shared"
import { budgetPct, budgetTone, fmtUsd, periodPace } from "./shared"
import { budgetNoteStore, budgetStore } from "./store"

const col = createColumnHelper<DataTableFeatures, Budget>()

const actionMeta: Record<BudgetAction, { icon: LucideIcon; hint: string }> = {
  "Alert only": { icon: BellIcon, hint: "Notify the owner; keep serving." },
  Throttle: {
    icon: GaugeIcon,
    hint: "Halve the agent's RPM quota until the period resets.",
  },
  "Downgrade model": {
    icon: TrendingDownIcon,
    hint: "Route to the next cheaper model in the chain.",
  },
  "Pause agent": {
    icon: PauseCircleIcon,
    hint: "Stop serving requests until the owner lifts the pause.",
  },
}

/** Display labels for `BudgetScope.kind` (never rely on CSS capitalisation). */
export const scopeKindLabel: Record<BudgetScopeKind, string> = {
  team: "Team",
  agent: "Agent",
  project: "Project",
}

const periodLabel: Record<BudgetPeriod, string> = {
  daily: "Daily",
  monthly: "Monthly",
}

const thresholdOptions = ["50", "80", "90", "100"]

function ScopeCell({ b }: { b: Budget }) {
  if (b.scope.kind === "agent")
    return <AgentChip agentId={b.scope.id} size="sm" />
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="inline-flex size-4 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <UsersIcon className="size-2.5" />
      </span>
      <span className="truncate font-medium">{b.scope.label}</span>
      <span className="text-muted-foreground">
        · {scopeKindLabel[b.scope.kind]}
      </span>
    </span>
  )
}

function UsedCell({ b }: { b: Budget }) {
  const pct = budgetPct(b)
  return (
    <AvailabilityBar
      value={Math.min(pct, 100)}
      target={periodPace(b.period)}
      tone={budgetTone(b)}
      size="sm"
      valueLabel={`${Math.round(pct)}%`}
      className="min-w-28"
    />
  )
}

function ActionBadge({ action }: { action: BudgetAction }) {
  const Icon = actionMeta[action].icon
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-muted-foreground",
        action === "Pause agent" && "border-destructive/30 text-danger-text",
        action === "Downgrade model" && "border-warning/40 text-warning-text"
      )}
      title={actionMeta[action].hint}
    >
      <Icon /> {action}
    </Badge>
  )
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Budget" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={row.original.name}
        secondary={<ScopeCell b={row.original} />}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-60", label: "Budget", skeleton: "w-44" },
  }),
  col.accessor("period", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Period" />
    ),
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {periodLabel[getValue()]}
      </span>
    ),
    meta: { width: "w-24", label: "Period", skeleton: "w-12" },
  }),
  col.accessor("limit", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Limit" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={formatCurrency} muted />
    ),
    meta: { width: "w-24", label: "Limit", numeric: true, skeleton: "w-12" },
  }),
  col.accessor("spent", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Spent"
        hint="Spend in the current period: today for daily budgets, month to date for monthly ones."
      />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtUsd} className="font-medium" />
    ),
    meta: { width: "w-24", label: "Spent", numeric: true, skeleton: "w-12" },
  }),
  col.accessor((b) => budgetPct(b), {
    id: "used",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Used"
        hint="Share of the limit spent. The marker shows how much of the period has elapsed, so a bar ahead of the marker is pacing to breach."
      />
    ),
    cell: ({ row }) => <UsedCell b={row.original} />,
    meta: { width: "w-40", label: "% used", skeleton: "w-28" },
  }),
  col.accessor("thresholds", {
    header: "Alerts at",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {getValue()
          .map((t) => `${t}%`)
          .join(" · ")}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-32", label: "Alert thresholds", skeleton: "w-20" },
  }),
  col.accessor("onBreach", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="On breach"
        hint="What the gateway does when spend reaches the limit."
      />
    ),
    cell: ({ getValue }) => <ActionBadge action={getValue()} />,
    meta: { width: "w-40", label: "Action on breach", skeleton: "w-24" },
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Status"
        hint="Exceeded: spent is at or over the limit. At risk: the linear projection ends the period at or above 90% of the limit."
      />
    ),
    cell: ({ getValue }) => <GatewayBadge state={getValue()} size="sm" />,
    sortFn: (a, b) => {
      const rank = { Exceeded: 0, "At risk": 1, "On track": 2 }
      return rank[a.original.status] - rank[b.original.status]
    },
    meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
])

const agentOptions = deployedAgents.map((a) => ({
  value: a.id,
  label: a.name,
}))

const facets: FacetDef<Budget>[] = [
  {
    id: "status",
    title: "Status",
    options: ["Exceeded", "At risk", "On track"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (b) => b.status,
  },
  {
    id: "scope",
    title: "Scope",
    options: (Object.keys(scopeKindLabel) as BudgetScopeKind[]).map((k) => ({
      value: k,
      label: scopeKindLabel[k],
    })),
    getValue: (b) => b.scope.kind,
  },
  {
    id: "agent",
    title: "Agent",
    options: agentOptions,
    getValue: (b) => (b.scope.kind === "agent" ? b.scope.id : ""),
  },
  {
    id: "period",
    title: "Period",
    options: (Object.keys(periodLabel) as BudgetPeriod[]).map((p) => ({
      value: p,
      label: periodLabel[p],
    })),
    getValue: (b) => b.period,
  },
  {
    id: "action",
    title: "On breach",
    options: (Object.keys(actionMeta) as BudgetAction[]).map((a) => ({
      value: a,
      label: a,
    })),
    getValue: (b) => b.onBreach,
  },
]

/** Status from the same rules the data module uses. */
function statusFor(spent: number, projected: number, limit: number) {
  const status: BudgetStatus =
    spent >= limit
      ? "Exceeded"
      : projected >= limit * 0.9
        ? "At risk"
        : "On track"
  return status
}

/** Daily spend history for a scope, read from the shared cost series. */
function historyFor(kind: BudgetScopeKind, id: string) {
  return costDaily.map((d) => ({
    name: d.name,
    spent:
      Math.round(
        (kind === "agent"
          ? (d.byAgent[id] ?? 0)
          : kind === "team"
            ? deployedAgents
                .filter((a) => a.team === id)
                .reduce((s, a) => s + (d.byAgent[a.id] ?? 0), 0)
            : 0) * 100
      ) / 100,
  }))
}

function describeChanges(prev: Budget, next: Budget, note: string) {
  const parts: string[] = []
  if (prev.limit !== next.limit)
    parts.push(
      `limit ${formatCurrency(prev.limit)} to ${formatCurrency(next.limit)}`
    )
  if (prev.thresholds.join() !== next.thresholds.join())
    parts.push(`alerts at ${next.thresholds.map((t) => `${t}%`).join(", ")}`)
  if (prev.onBreach !== next.onBreach) parts.push(`on breach: ${next.onBreach}`)
  if (prev.status !== next.status) parts.push(`status now ${next.status}`)
  if (note.trim()) parts.push("note recorded")
  return parts
}

export function BudgetsTable({
  initialAgentId,
  openId,
  onOpenChange: openBudget,
}: {
  /** Preselects the agent facet (`?agent=`). */
  initialAgentId?: string
  /** The budget whose sheet is open (`?budget=`); unknown ids are ignored. */
  openId: string | null
  /** Called with the row id to open, `null` to close; the owner writes the URL. */
  onOpenChange: (id: string | null) => void
}) {
  const items = budgetStore.use()
  const [creating, setCreating] = React.useState(false)
  const open = items.find((b) => b.id === openId) ?? null

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(b) => b.id}
        getSearchText={(b) => `${b.name} ${b.scope.label} ${b.onBreach}`}
        searchPlaceholder="Search budgets..."
        facets={facets}
        initialFacets={initialAgentId ? { agent: [initialAgentId] } : undefined}
        initialSorting={[{ id: "status", desc: false }]}
        initialColumnVisibility={{ thresholds: false, updated: false }}
        onRowClick={(b) => openBudget(b.id)}
        totalLabel="budgets"
        caption="Budgets with their period, limit, spend, alert thresholds and breach action"
        selectionLabel={(n) => (n === 1 ? "budget" : "budgets")}
        toolbar={
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> New budget
          </Button>
        }
      />

      <Sheet open={open !== null} onOpenChange={(o) => !o && openBudget(null)}>
        <SheetContent
          className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
        >
          {open && (
            <BudgetSheetBody
              key={open.id}
              budget={open}
              onSave={(next, note) => {
                const changes = describeChanges(open, next, note)
                budgetStore.patch(next.id, next)
                if (note.trim())
                  budgetNoteStore.set((s) => ({
                    notes: { ...s.notes, [next.id]: note.trim() },
                  }))
                openBudget(null)
                if (changes.length === 0) {
                  toast(`${next.name} unchanged`)
                  return
                }
                toast.success(`${next.name} saved`, {
                  description: changes.join(" · "),
                })
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <SheetContent
          className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
        >
          {creating && (
            <BudgetSheetBody
              mode="create"
              budget={draftBudget(items.length)}
              onSave={(next, note) => {
                budgetStore.add(next, "start")
                if (note.trim())
                  budgetNoteStore.set((s) => ({
                    notes: { ...s.notes, [next.id]: note.trim() },
                  }))
                setCreating(false)
                toast.success(`${next.name} created`, {
                  description: `${formatCurrency(next.limit)} ${next.period} · ${next.onBreach} on breach · ${next.status}`,
                })
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Blank budget for create mode; scope and history are filled in on save. */
function draftBudget(count: number): Budget {
  const first = deployedAgents[0]
  return {
    id: `bud-${String(count + 1).padStart(3, "0")}`,
    name: "",
    scope: { kind: "agent", id: first.id, label: first.name },
    period: "monthly",
    limit: 1000,
    spent: 0,
    projected: 0,
    thresholds: [50, 80, 100],
    onBreach: "Alert only",
    ownerId: currentUser.id,
    status: "On track",
    history: historyFor("agent", first.id),
    updated: NOW.toISOString(),
  }
}

const actionItems = (Object.keys(actionMeta) as BudgetAction[]).map((a) => ({
  value: a,
  label: a,
}))
const scopeItems = (Object.keys(scopeKindLabel) as BudgetScopeKind[]).map(
  (k) => ({ value: k, label: scopeKindLabel[k] })
)
const periodItems = (Object.keys(periodLabel) as BudgetPeriod[]).map((p) => ({
  value: p,
  label: periodLabel[p],
}))
const teamItems = Array.from(new Set(deployedAgents.map((a) => a.team))).map(
  (t) => ({ value: t, label: t })
)

const confirmActions: BudgetAction[] = ["Throttle", "Pause agent"]

function BudgetSheetBody({
  budget: b,
  mode = "edit",
  onSave,
}: {
  budget: Budget
  mode?: "edit" | "create"
  onSave: (b: Budget, note: string) => void
}) {
  const create = mode === "create"
  const [name, setName] = React.useState(b.name)
  const [scopeKind, setScopeKind] = React.useState<BudgetScopeKind>(
    b.scope.kind
  )
  const [scopeId, setScopeId] = React.useState(b.scope.id)
  const [period, setPeriod] = React.useState<BudgetPeriod>(b.period)
  const [limit, setLimit] = React.useState(String(b.limit))
  const [action, setAction] = React.useState<BudgetAction>(b.onBreach)
  const [thresholds, setThresholds] = React.useState<string[]>(
    b.thresholds.map(String)
  )
  const [note, setNote] = React.useState("")
  const [pending, setPending] = React.useState<Budget | null>(null)
  const notes = budgetNoteStore.use().notes
  const lastNote = notes[b.id]

  const limitNum = Number(limit)
  const valid =
    Number.isFinite(limitNum) &&
    limitNum > 0 &&
    thresholds.length > 0 &&
    (!create || name.trim().length >= 3) &&
    (!create || scopeKind === "project" || scopeId.length > 0)
  const pct = budgetPct(b)
  const history = b.history.slice(b.period === "daily" ? -14 : -30)
  const dailyLimit = b.period === "daily" ? b.limit : b.limit / 30
  const owner = getUser(b.ownerId)
  const formId = `budget-${b.id}`

  function build(): Budget {
    const nextLimit = limitNum
    const sortedThresholds = thresholds.map(Number).sort((x, y) => x - y)
    if (!create) {
      return {
        ...b,
        limit: nextLimit,
        onBreach: action,
        thresholds: sortedThresholds,
        status: statusFor(b.spent, b.projected, nextLimit),
        updated: NOW.toISOString(),
      }
    }
    const label =
      scopeKind === "agent"
        ? (deployedAgents.find((a) => a.id === scopeId)?.name ?? scopeId)
        : scopeKind === "team"
          ? scopeId
          : name.trim()
    const scope = {
      kind: scopeKind,
      id: scopeKind === "project" ? name.trim().toLowerCase() : scopeId,
      label,
    }
    const hist = historyFor(scopeKind, scope.id)
    const dayOfMonth = NOW.getUTCDate()
    const spent =
      period === "daily"
        ? scopeKind === "agent"
          ? spendTodayByAgent(scope.id)
          : hist[hist.length - 1].spent
        : Math.round(
            hist.slice(-dayOfMonth).reduce((s, h) => s + h.spent, 0) * 100
          ) / 100
    const pace = periodPace(period) / 100
    const projected =
      period === "daily"
        ? spent
        : Math.round((spent / Math.max(pace, 1 / 31)) * 100) / 100
    return {
      ...b,
      name: name.trim(),
      scope,
      period,
      limit: nextLimit,
      spent,
      projected,
      thresholds: sortedThresholds,
      onBreach: action,
      status: statusFor(spent, projected, nextLimit),
      history: hist,
      updated: NOW.toISOString(),
    }
  }

  function submit() {
    if (!valid) return
    const next = build()
    const escalates =
      next.onBreach !== b.onBreach &&
      confirmActions.includes(next.onBreach) &&
      next.status !== "On track"
    if (escalates) setPending(next)
    else onSave(next, note)
  }

  const scopeTargetItems =
    scopeKind === "agent" ? agentOptions : scopeKind === "team" ? teamItems : []

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 py-5">
        {create ? (
          <>
            <SheetTitle className="text-lg leading-tight">
              New budget
            </SheetTitle>
            <SheetDescription>
              Spend for the scope is read from the shared cost series, so the
              status is computed the moment you save.
            </SheetDescription>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <GatewayBadge state={b.status} />
              <Badge variant="outline" className="text-muted-foreground">
                {periodLabel[b.period]}
              </Badge>
              <ActionBadge action={b.onBreach} />
              <span className="ml-auto">
                <UserChip userId={b.ownerId} size="xs" />
              </span>
            </div>
            <SheetTitle className="text-lg leading-tight">{b.name}</SheetTitle>
            <SheetDescription>
              <ScopeCell b={b} />
            </SheetDescription>
          </>
        )}
      </SheetHeader>

      <SheetBody>
        <div className="flex flex-col gap-6">
          {!create && (
            <>
              <section className="rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums">
                    {fmtUsd(b.spent)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      of {formatCurrency(b.limit)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    projected {formatCurrency(b.projected)}
                  </p>
                </div>
                <AvailabilityBar
                  value={Math.min(pct, 100)}
                  target={periodPace(b.period)}
                  tone={budgetTone(b)}
                  className="mt-2"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {Math.round(pct)}% used · {Math.round(periodPace(b.period))}%
                  of the {b.period === "daily" ? "day" : "month"} elapsed.{" "}
                  {b.status === "Exceeded"
                    ? `Breached: "${b.onBreach}" is in effect.`
                    : b.status === "At risk"
                      ? "On current pace this budget will be exceeded."
                      : "Pacing within limit."}
                </p>
              </section>

              <section className="flex flex-col gap-2">
                <Eyebrow as="h3">Related</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link
                        href={
                          b.scope.kind === "agent"
                            ? `/agentops/costs?tab=allocation&agent=${b.scope.id}`
                            : "/agentops/costs?tab=allocation"
                        }
                      />
                    }
                  >
                    Allocation
                  </Button>
                  {b.scope.kind === "agent" && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <Link href={`/agentops/traces?agent=${b.scope.id}`} />
                      }
                    >
                      Traces
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/agentops/providers?tab=routing" />}
                  >
                    Routing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/agentops/audit?source=budget" />}
                  >
                    Audit history
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  Daily spend · last {history.length} days
                </h3>
                <StackedBarChart
                  data={history.map((h) => ({
                    name: h.name,
                    within: Math.min(h.spent, dailyLimit),
                    over: Math.max(0, h.spent - dailyLimit),
                  }))}
                  series={[
                    {
                      key: "within",
                      label: "Within limit",
                      color: "var(--chart-1)",
                    },
                    {
                      key: "over",
                      label: "Over limit",
                      color: "var(--chart-2)",
                    },
                  ]}
                  height={180}
                  valueFormatter={fmtUsd}
                  xTickFormatter={(v) => v.replace(/^\w{3} /, "")}
                />
                <p className="text-xs text-muted-foreground">
                  {b.period === "daily"
                    ? `Daily limit ${formatCurrency(b.limit)}.`
                    : `Monthly limit spread evenly: ${fmtUsd(dailyLimit)} per day.`}
                </p>
              </section>
            </>
          )}

          <form
            id={formId}
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <h3 className="text-sm font-semibold">
              {create ? "Budget" : "Edit budget"}
            </h3>
            <FieldGroup>
              {create && (
                <>
                  <Field>
                    <FieldLabel htmlFor={`${b.id}-name`}>Name</FieldLabel>
                    <Input
                      id={`${b.id}-name`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Support Triage · monthly"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`${b.id}-scope`}>Scope</FieldLabel>
                      <Select
                        items={scopeItems}
                        value={scopeKind}
                        onValueChange={(v) => {
                          if (!v) return
                          const kind = v as BudgetScopeKind
                          setScopeKind(kind)
                          setScopeId(
                            kind === "agent"
                              ? deployedAgents[0].id
                              : kind === "team"
                                ? teamItems[0].value
                                : ""
                          )
                        }}
                      >
                        <SelectTrigger id={`${b.id}-scope`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scopeItems.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {scopeKind !== "project" && (
                      <Field>
                        <FieldLabel htmlFor={`${b.id}-target`}>
                          {scopeKindLabel[scopeKind]}
                        </FieldLabel>
                        <Select
                          items={scopeTargetItems}
                          value={scopeId}
                          onValueChange={(v) => v && setScopeId(String(v))}
                        >
                          <SelectTrigger
                            id={`${b.id}-target`}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {scopeTargetItems.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`${b.id}-period`}>Period</FieldLabel>
                    <Select
                      items={periodItems}
                      value={period}
                      onValueChange={(v) => v && setPeriod(v as BudgetPeriod)}
                    >
                      <SelectTrigger id={`${b.id}-period`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodItems.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}
              <Field>
                <FieldLabel htmlFor={`${b.id}-limit`}>
                  {periodLabel[create ? period : b.period]} limit (USD)
                </FieldLabel>
                <Input
                  id={`${b.id}-limit`}
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel>Alert thresholds</FieldLabel>
                <ToggleGroup
                  multiple
                  value={thresholds}
                  onValueChange={(v) => setThresholds(v as string[])}
                  aria-label="Alert thresholds"
                >
                  {thresholdOptions.map((t) => (
                    <ToggleGroupItem
                      key={t}
                      value={t}
                      size="sm"
                      variant="outline"
                      className="tabular-nums"
                    >
                      {t}%
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>
                  The owner is notified at each selected share of the limit.
                  Pick at least one; 100% is the breach itself.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${b.id}-action`}>
                  Action on breach
                </FieldLabel>
                <Select
                  items={actionItems}
                  value={action}
                  onValueChange={(v) => v && setAction(v as BudgetAction)}
                >
                  <SelectTrigger id={`${b.id}-action`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionItems.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{actionMeta[action].hint}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${b.id}-note`}>Note</FieldLabel>
                <Textarea
                  id={`${b.id}-note`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Driver you found and why the limit or action changed"
                />
                <FieldDescription>
                  {lastNote
                    ? `Last note: ${lastNote}`
                    : "Kept with the budget for next month's review."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </div>
      </SheetBody>
      <SheetFooterActions
        primary={
          <Button type="submit" form={formId} disabled={!valid}>
            <CheckIcon /> {create ? "Create budget" : "Save budget"}
          </Button>
        }
      />

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch {b.name} to &quot;{pending?.onBreach}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This budget is {b.status.toLowerCase()}, so the action applies to{" "}
              {b.scope.label}
              {b.scope.kind === "agent"
                ? ""
                : ` (${scopeKindLabel[b.scope.kind].toLowerCase()} scope)`}{" "}
              as soon as the limit is reached
              {b.status === "Exceeded" ? ", which it already is" : ""}.{" "}
              {pending?.onBreach === "Pause agent"
                ? "Users get no answers until the pause is lifted."
                : "Requests above half the current quota are rate limited."}{" "}
              {owner ? `${owner.name} owns this budget.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) onSave(pending, note)
                setPending(null)
              }}
            >
              {pending?.onBreach === "Pause agent" ? (
                <PauseCircleIcon />
              ) : (
                <GaugeIcon />
              )}{" "}
              Save and {pending?.onBreach.toLowerCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
