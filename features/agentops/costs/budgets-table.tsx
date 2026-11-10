"use client"

import * as React from "react"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  budgets as seed,
  type Budget,
  type BudgetAction,
} from "@/lib/data/costs"
import { formatCurrency } from "@/lib/format"
import { GatewayBadge } from "../providers/shared"
import { AgentChip } from "../shared"
import { budgetPct, budgetTone, fmtUsd, periodPace } from "./shared"

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

function ScopeCell({ b }: { b: Budget }) {
  if (b.scope.kind === "agent")
    return <AgentChip agentId={b.scope.id} size="sm" />
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="inline-flex size-4 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <UsersIcon className="size-2.5" />
      </span>
      <span className="truncate font-medium">{b.scope.label}</span>
      <span className="text-muted-foreground capitalize">· {b.scope.kind}</span>
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
      <span className="text-xs text-muted-foreground capitalize">
        {getValue()}
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
      <DataTableColumnHeader column={column} title="Spent" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={fmtUsd} className="font-medium" />
    ),
    meta: { width: "w-24", label: "Spent", numeric: true, skeleton: "w-12" },
  }),
  col.accessor((b) => budgetPct(b), {
    id: "used",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Used" />
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
      <DataTableColumnHeader column={column} title="On breach" />
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
      <DataTableColumnHeader column={column} title="Status" />
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
    options: [
      { value: "team", label: "Team" },
      { value: "agent", label: "Agent" },
      { value: "project", label: "Project" },
    ],
    getValue: (b) => b.scope.kind,
  },
  {
    id: "period",
    title: "Period",
    options: [
      { value: "daily", label: "Daily" },
      { value: "monthly", label: "Monthly" },
    ],
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

export function BudgetsTable() {
  const [items, setItems] = React.useState<Budget[]>(seed)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const open = items.find((b) => b.id === openId) ?? null

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(b) => b.id}
        getSearchText={(b) => `${b.name} ${b.scope.label} ${b.onBreach}`}
        searchPlaceholder="Search budgets…"
        facets={facets}
        initialSorting={[{ id: "status", desc: false }]}
        initialColumnVisibility={{ thresholds: false, updated: false }}
        onRowClick={(b) => setOpenId(b.id)}
        totalLabel="budgets"
        selectionLabel={(n) => (n === 1 ? "budget" : "budgets")}
        toolbar={
          <Button size="sm" onClick={() => toast("Budget wizard opened")}>
            <PlusIcon /> New budget
          </Button>
        }
      />
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {open && (
            <BudgetSheetBody
              key={open.id}
              budget={open}
              onSave={(next) => {
                setItems((prev) =>
                  prev.map((b) => (b.id === next.id ? next : b))
                )
                setOpenId(null)
                toast.success("Budget updated", {
                  description: `${next.name} · ${formatCurrency(next.limit)} ${next.period} · ${next.onBreach.toLowerCase()} on breach`,
                })
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

const actionItems = (Object.keys(actionMeta) as BudgetAction[]).map((a) => ({
  value: a,
  label: a,
}))

function BudgetSheetBody({
  budget: b,
  onSave,
}: {
  budget: Budget
  onSave: (b: Budget) => void
}) {
  const [limit, setLimit] = React.useState(String(b.limit))
  const [action, setAction] = React.useState<BudgetAction>(b.onBreach)
  const [thresholds, setThresholds] = React.useState<string[]>(
    b.thresholds.map(String)
  )
  const limitNum = Number(limit)
  const valid =
    Number.isFinite(limitNum) && limitNum > 0 && thresholds.length > 0
  const pct = budgetPct(b)
  const history = b.history.slice(b.period === "daily" ? -14 : -30)
  const dailyLimit = b.period === "daily" ? b.limit : b.limit / 30

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <GatewayBadge state={b.status} />
          <Badge variant="outline" className="text-muted-foreground capitalize">
            {b.period}
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
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-6">
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
              {Math.round(pct)}% used · {Math.round(periodPace(b.period))}% of
              the {b.period === "daily" ? "day" : "month"} elapsed (tick).{" "}
              {b.status === "Exceeded"
                ? `Breached — "${b.onBreach}" is in effect.`
                : b.status === "At risk"
                  ? "On current pace this budget will be exceeded."
                  : "Pacing within limit."}
            </p>
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
                { key: "over", label: "Over limit", color: "var(--chart-2)" },
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

          <form
            id={`budget-${b.id}`}
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!valid) return
              const nextLimit = limitNum
              const status: Budget["status"] =
                b.spent >= nextLimit
                  ? "Exceeded"
                  : b.projected >= nextLimit * 0.9
                    ? "At risk"
                    : "On track"
              onSave({
                ...b,
                limit: nextLimit,
                onBreach: action,
                thresholds: thresholds.map(Number).sort((x, y) => x - y),
                status,
              })
            }}
          >
            <h3 className="text-sm font-semibold">Edit budget</h3>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${b.id}-limit`}>
                  {b.period === "daily" ? "Daily" : "Monthly"} limit (USD)
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
                  {["50", "80", "90", "100"].map((t) => (
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
            </FieldGroup>
          </form>
        </div>
      </div>
      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button type="submit" form={`budget-${b.id}`} disabled={!valid}>
          <CheckIcon /> Save budget
        </Button>
      </SheetFooter>
    </>
  )
}
