"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  BotIcon,
  FlaskConicalIcon,
  LightbulbIcon,
  OctagonXIcon,
  PenOffIcon,
  WavesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ChartCard } from "@/components/charts/chart-card"
import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { CountPill } from "@/components/shared/count-pill"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  agentTraces,
  fleetControls,
  fleetDaily,
  pendingReviewCount,
  telemetryHealth,
} from "@/lib/data/agentops"
import { compareWindows, mean } from "@/lib/data/metrics"
import { NOW, clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatCurrency, formatMs, formatNumber, timeAgo } from "@/lib/format"
import type { FleetControls, TraceOutcome } from "@/lib/types"
import { budgetTone } from "./agent-config/agent-slo-card"
import { AgentChip, FrameworkBadge, ModelChip, ScoreBar } from "./shared"
import {
  agentStore,
  driftStore,
  experimentStore,
  recommendationStore,
  reviewStore,
} from "./stores"

/**
 * Outcomes folded into five fixed-order series. Failure modes share one
 * series; the trace table has the full split.
 */
type OutcomeGroupKey =
  "completed" | "partial" | "refused" | "failed" | "abandoned"
const outcomeGroups: {
  key: OutcomeGroupKey
  label: string
  color: string
}[] = [
  { key: "completed", label: "Completed", color: "var(--chart-1)" },
  { key: "partial", label: "Partial", color: "var(--chart-4)" },
  { key: "refused", label: "Refused", color: "var(--chart-3)" },
  {
    key: "failed",
    label: "Failed (tool, timeout, rate limit, invalid)",
    color: "var(--chart-2)",
  },
  { key: "abandoned", label: "Abandoned", color: "var(--chart-5)" },
]
const groupOf: Record<TraceOutcome, OutcomeGroupKey> = {
  completed: "completed",
  partial: "partial",
  refused: "refused",
  tool_error: "failed",
  timeout: "failed",
  rate_limited: "failed",
  invalid_output: "failed",
  abandoned: "abandoned",
}

export function FleetOverview() {
  const agents = agentStore.use()
  const live = agents.filter((a) => a.environment === "production")
  const requests = live.reduce((s, a) => s + a.metrics.requests24h, 0)
  const cost = live.reduce((s, a) => s + a.metrics.costPerDay, 0)
  const quality = Math.round(
    live.reduce((s, a) => s + a.metrics.quality * a.metrics.requests24h, 0) /
      Math.max(1, requests)
  )
  const errors = live.reduce(
    (s, a) => s + (a.metrics.errorRate / 100) * a.metrics.requests24h,
    0
  )
  const pending = pendingReviewCount(reviewStore.use())
  const openDrift = driftStore.use().filter((d) => d.state !== "Resolved")
  const running = experimentStore.use().filter((e) => e.status === "Running")
  const openRecs = recommendationStore
    .use()
    .filter((r) => r.status === "New" || r.status === "Testing")
  const unhealthy = live.filter((a) => a.paused || a.health !== "Healthy")

  const reqDelta = compareWindows(
    fleetDaily.map((d) => d.requests),
    7
  ).deltaPct
  const costDelta = compareWindows(
    fleetDaily.map((d) => d.cost),
    7
  ).deltaPct
  const qDelta = compareWindows(
    fleetDaily.map((d) => d.quality),
    7,
    mean
  ).delta

  const byModel = new Map<string, number>()
  for (const a of live)
    byModel.set(a.modelId, (byModel.get(a.modelId) ?? 0) + a.metrics.costPerDay)
  const costByModel = [...byModel.entries()]
    .map(([m, v]) => ({
      name: (m.split("/").pop() ?? m).replace(/-preview$/, ""),
      value: Math.round(v),
    }))
    .sort((a, b) => b.value - a.value)

  const burning = live.filter((a) => a.errorBudget.burnRate1h > 2)
  const worstBurn = [...burning].sort(
    (a, b) => b.errorBudget.burnRate1h - a.errorBudget.burnRate1h
  )[0]

  // Outcomes over the last 24h, bucketed into 4h slots, one series per group.
  const cutoff = NOW.getTime() - 24 * 3_600_000
  const recent = agentTraces.filter(
    (t) => new Date(t.startedAt).getTime() >= cutoff
  )
  const slots = Array.from({ length: 6 }, (_, i) => {
    const start = cutoff + i * 4 * 3_600_000
    const label = new Date(start).toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "UTC",
    })
    const row: Record<string, string | number> = { name: `${label}:00` }
    for (const g of outcomeGroups) row[g.key] = 0
    return { start, row }
  })
  for (const t of recent) {
    const idx = Math.min(
      5,
      Math.floor((new Date(t.startedAt).getTime() - cutoff) / (4 * 3_600_000))
    )
    const row = slots[idx].row
    const key = groupOf[t.outcome]
    row[key] = (row[key] as number) + 1
  }
  const notCompleted = recent.filter((t) => t.outcome !== "completed").length
  const outcomeSeries = outcomeGroups.filter((g) =>
    recent.some((t) => groupOf[t.outcome] === g.key)
  )

  return (
    <div className="flex flex-col gap-6">
      {unhealthy.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
          <WavesIcon className="size-4 shrink-0 text-warning-text" />
          <p className="text-sm">
            <span className="font-medium">
              {unhealthy.length} production agent
              {unhealthy.length === 1 ? "" : "s"} need attention:
            </span>{" "}
            {unhealthy.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link
                  href={`/agentops/agents/${a.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {a.name}
                </Link>{" "}
                <span className="text-muted-foreground">
                  ({a.paused ? "paused" : a.health.toLowerCase()})
                </span>
              </span>
            ))}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            render={<Link href="/agentops/drift" />}
          >
            Open drift board <ArrowRightIcon />
          </Button>
        </div>
      )}

      <FleetControlsStrip initial={fleetControls} />

      <StatGrid columns={4} size="default">
        <StatCard
          label="Requests · 24h"
          value={formatNumber(requests, true)}
          delta={reqDelta ?? undefined}
          deltaLabel="vs prior 7 days"
          hint={`${live.length} production agents · ${formatNumber(Math.round(errors))} errors`}
          sparkline={
            <Sparkline data={fleetDaily.slice(-14).map((d) => d.requests)} />
          }
        />
        <StatCard
          label="Quality score"
          value={quality}
          unit="/100"
          delta={qDelta}
          deltaUnit="pts"
          deltaLabel="vs prior 7 days"
          hint="Traffic-weighted evaluator composite"
          sparkline={
            <Sparkline
              data={fleetDaily.slice(-14).map((d) => d.quality)}
              color="var(--chart-1)"
            />
          }
        />
        <StatCard
          label="Spend · day"
          value={formatCurrency(cost)}
          delta={costDelta ?? undefined}
          upIsGood={false}
          deltaLabel="vs prior 7 days"
          hint={`About ${formatCurrency(cost * 30, true)} / month at current traffic`}
          sparkline={
            <Sparkline
              data={fleetDaily.slice(-14).map((d) => d.cost)}
              color="var(--chart-2)"
            />
          }
        />
        <StatCard
          label="Awaiting review"
          value={pending}
          hint={`${openDrift.length} drift signals · ${running.length} experiments running`}
          href="/agentops/reviews"
        />
      </StatGrid>

      <StatGrid columns={4}>
        <StatCard
          label="Agents burning error budget"
          value={
            <span
              className={cn(
                burning.length > 0 && toneClasses[budgetTone(worstBurn)].text
              )}
            >
              {burning.length}
            </span>
          }
          unit={`/ ${live.length}`}
          hint={
            worstBurn
              ? `${worstBurn.name} at ${worstBurn.errorBudget.burnRate1h.toFixed(1)}x burn · ${Math.round(worstBurn.errorBudget.remaining * 100)}% left. Above 2x the 28-day budget runs out early.`
              : "All agents within 2x burn (1x spends the 28-day budget exactly on pace)"
          }
          href={worstBurn ? `/agentops/agents/${worstBurn.id}` : undefined}
        />
        <StatCard
          label="Outcomes · 24h"
          value={formatNumber(recent.length - notCompleted)}
          unit={`/ ${formatNumber(recent.length)} completed`}
          hint={`${notCompleted} partial, refused or failed`}
          href="/agentops/traces"
        />
        <StatCard
          label="Trace coverage"
          value={`${telemetryHealth.traceCoverage}%`}
          hint={`${telemetryHealth.droppedSpanRate}% spans dropped · ${telemetryHealth.exportFailures24h} export failures`}
        />
        <StatCard
          label="Ingestion lag p95"
          value={`${telemetryHealth.ingestionLagP95S} s`}
          hint={
            telemetryHealth.ingestionLagP95S > 60
              ? "Traces may lag behind live traffic"
              : "Span end to queryable"
          }
        />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Traffic and reviews"
          description="Requests per day with the share sampled into human review, last 30 days"
        >
          <StackedBarChart
            data={fleetDaily.map((d) => ({
              name: d.name,
              served: d.requests - d.reviewed,
              reviewed: d.reviewed,
            }))}
            series={[
              { key: "served", label: "Served", color: "var(--chart-5)" },
              {
                key: "reviewed",
                label: "Human reviewed",
                color: "var(--chart-1)",
              },
            ]}
            height={CHART_HEIGHT.md}
            valueFormatter={(v) => formatNumber(v, true)}
          />
        </ChartCard>
        <ChartCard
          title="Quality trend"
          description="Fleet composite score, last 30 days"
        >
          <IncidentTrendChart
            data={fleetDaily.map((d) => ({ name: d.name, quality: d.quality }))}
            series={[
              { key: "quality", label: "Quality", color: "var(--chart-1)" },
            ]}
            height={CHART_HEIGHT.md}
            showLegend={false}
            valueFormatter={(v) => v.toFixed(1)}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Outcomes (24h)"
        description="Sampled traces by run outcome in 4-hour buckets (UTC). Partial and refused runs are still ok; the rest are failure modes."
        action={
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/agentops/traces" />}
          >
            Traces <ArrowRightIcon />
          </Button>
        }
      >
        <StackedBarChart
          data={slots.map((s) => s.row)}
          series={outcomeSeries}
          height={CHART_HEIGHT.sm}
          valueFormatter={(v) => formatNumber(v)}
        />
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-3">
            <CardTitle>Agents</CardTitle>
            <CardDescription>Production fleet by traffic</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/agentops/agents" />}
              >
                All agents <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <ul className="divide-y">
            {[...live]
              .sort((a, b) => b.metrics.requests24h - a.metrics.requests24h)
              .map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5 sm:grid-cols-[minmax(0,1.6fr)_7rem_6rem_5rem_auto]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <BotIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/agentops/agents/${a.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <FrameworkBadge
                          framework={a.framework}
                          className="h-4 px-1 text-3xs"
                        />
                        <ModelChip modelId={a.modelId} className="text-2xs" />
                      </div>
                    </div>
                  </div>
                  <span className="hidden text-right font-mono text-xs text-muted-foreground tabular-nums sm:block">
                    {formatNumber(a.metrics.requests24h)} req
                  </span>
                  <span className="hidden text-right font-mono text-xs text-muted-foreground tabular-nums sm:block">
                    p95 {formatMs(a.metrics.p95Ms)}
                  </span>
                  <ScoreBar
                    value={a.metrics.quality}
                    className="hidden sm:inline-flex"
                  />
                  <StateBadge
                    state={a.paused ? "Paused" : a.health}
                    size="sm"
                  />
                </li>
              ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <ChartCard
            title="Spend by model"
            description="Cost per day across production agents"
          >
            <HorizontalBarChart
              data={costByModel}
              height={costByModel.length * 32 + 8}
              valueFormatter={(v) => `$${v}`}
              color="var(--chart-2)"
            />
          </ChartCard>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center gap-2">
                Needs a decision
                <CountPill
                  count={openRecs.length + running.length}
                  size="default"
                  label="items"
                />
              </CardTitle>
            </CardHeader>
            <ul className="divide-y">
              {openRecs.slice(0, 2).map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-warning-text" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/agentops/recommendations?open=${r.id}`}
                      className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      Recommendation · {Math.round(r.confidence * 100)}%
                      confidence · {timeAgo(r.created)}
                    </p>
                  </div>
                </li>
              ))}
              {running.slice(0, 2).map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/agentops/experiments?open=${e.id}`}
                      className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
                    >
                      {e.name}
                    </Link>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      Experiment · {Math.round(e.significance * 100)}% P(B &gt;
                      A) ·{" "}
                      <AgentChip
                        agentId={e.agentId}
                        size="sm"
                        className="inline-flex align-middle"
                      />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Fleet controls                                                              */
/* -------------------------------------------------------------------------- */

type ControlKey = "killSwitch" | "writesDisabled"

const controlMeta: Record<
  ControlKey,
  {
    label: string
    icon: React.ReactNode
    on: string
    off: string
    confirmTitle: string
    confirmBody: string
    engage: string
  }
> = {
  killSwitch: {
    label: "Kill switch",
    icon: <OctagonXIcon />,
    on: "All agents stopped. No new runs are accepted.",
    off: "Agents accept new runs",
    confirmTitle: "Engage the fleet kill switch?",
    confirmBody:
      "Every agent stops accepting new runs immediately. In-flight runs are allowed to finish, schedules and triggers are skipped, and users see a maintenance message. The change is recorded on this page with your name and the time for the rest of the session.",
    engage: "Engage kill switch",
  },
  writesDisabled: {
    label: "Writes disabled",
    icon: <PenOffIcon />,
    on: "Write-capable tools are blocked fleet-wide",
    off: "Tools may write to downstream systems",
    confirmTitle: "Disable all write-capable tools?",
    confirmBody:
      "Agents keep answering, but any tool that creates, updates or deletes records (tickets, access, password resets) is refused with a policy message until writes are re-enabled. The change is recorded on this page with your name and the time for the rest of the session.",
    engage: "Disable writes",
  },
}

/**
 * Fleet-wide emergency controls. Toggling is local to the session, but
 * engaging either control asks for confirmation because of its blast radius.
 */
function FleetControlsStrip({ initial }: { initial: FleetControls }) {
  const [controls, setControls] = React.useState(initial)
  const [pending, setPending] = React.useState<ControlKey | null>(null)
  const engaged = controls.killSwitch || controls.writesDisabled

  const apply = (key: ControlKey, value: boolean) => {
    setControls({
      ...controls,
      [key]: value,
      changedAt: clock().toISOString(),
      changedBy: currentUser.id,
    })
    const meta = controlMeta[key]
    if (value) toast.warning(`${meta.label} engaged`, { description: meta.on })
    else toast.success(`${meta.label} released`, { description: meta.off })
  }

  const request = (key: ControlKey, value: boolean) => {
    if (value) setPending(key)
    else apply(key, false)
  }

  return (
    <section
      aria-label="Fleet controls"
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-4 py-3",
        engaged ? "border-destructive/40 bg-destructive/5" : "bg-card"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
            engaged
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          )}
        >
          <OctagonXIcon />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Fleet controls</h2>
          <p className="truncate text-xs text-muted-foreground">
            {engaged
              ? "Emergency control engaged"
              : "All clear. Both controls off."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {(Object.keys(controlMeta) as ControlKey[]).map((key) => {
          const meta = controlMeta[key]
          const on = controls[key]
          return (
            <div key={key} className="flex items-center gap-2.5">
              <Switch
                id={`fleet-${key}`}
                checked={on}
                onCheckedChange={(v) => request(key, v)}
                aria-describedby={`fleet-${key}-desc`}
              />
              <Label
                htmlFor={`fleet-${key}`}
                className="flex cursor-pointer flex-col gap-0 text-sm"
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-medium [&_svg]:size-3.5",
                    on && toneClasses.danger.text
                  )}
                >
                  {meta.icon}
                  {meta.label}
                  {on && <StateBadge state="Engaged" tone="danger" size="sm" />}
                </span>
                <span
                  id={`fleet-${key}-desc`}
                  className="text-2xs font-normal text-muted-foreground"
                >
                  {on ? meta.on : meta.off}
                </span>
              </Label>
            </div>
          )
        })}
      </div>

      <p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        Changed {timeAgo(controls.changedAt)} by{" "}
        <UserChip userId={controls.changedBy} size="xs" />
      </p>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? controlMeta[pending].confirmTitle : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? controlMeta[pending].confirmBody : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) apply(pending, true)
                setPending(null)
              }}
            >
              {pending ? controlMeta[pending].engage : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
