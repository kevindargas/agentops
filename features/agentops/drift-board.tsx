"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  BellOffIcon,
  CheckIcon,
  FlaskConicalIcon,
  RouteIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ChartCard } from "@/components/charts/chart-card"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { deployedAgents, driftSignals as seed, fleetDaily } from "@/lib/data"
import { timeAgo } from "@/lib/format"
import type { DriftKind, DriftSignal, DriftState } from "@/lib/types"
import { AgentChip } from "./shared"

const kindLabel: Record<DriftKind, string> = {
  input: "Input drift",
  output: "Output drift",
  quality: "Quality regression",
  tool: "Tool reliability",
  cost: "Cost anomaly",
}
const severityRank = { Critical: 0, Warning: 1, Info: 2 }

function fmtVal(v: number, unit: string) {
  const n =
    Math.abs(v) < 1 && unit === ""
      ? v.toFixed(2)
      : Number.isInteger(v)
        ? String(v)
        : v.toFixed(1)
  return unit === "$"
    ? `$${n}`
    : `${n}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`
}

export function DriftBoard() {
  const [signals, setSignals] = React.useState<DriftSignal[]>(seed)
  const [state, setState] = React.useState<"active" | DriftState | "all">(
    "active"
  )

  const visible = signals
    .filter((s) =>
      state === "active"
        ? s.state !== "Resolved"
        : state === "all"
          ? true
          : s.state === state
    )
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        b.detected.localeCompare(a.detected)
    )

  const byAgent = new Map<string, DriftSignal[]>()
  for (const s of visible)
    byAgent.set(s.agentId, [...(byAgent.get(s.agentId) ?? []), s])

  const update = (id: string, next: DriftState) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state: next } : s))
    )
    toast(next === "Resolved" ? "Signal resolved" : "Signal acknowledged", {
      description: signals.find((s) => s.id === id)?.metric,
    })
  }

  const quality = fleetDaily
    .slice(-14)
    .map((d) => ({ name: d.name, quality: d.quality, baseline: 89.5 }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <ChartCard
          className="min-w-0"
          title="Fleet quality vs baseline"
          description="Composite evaluator score across production agents, last 14 days"
        >
          <IncidentTrendChart
            data={quality}
            series={[
              { key: "quality", label: "Quality", color: "var(--chart-1)" },
              { key: "baseline", label: "Baseline", color: "var(--chart-5)" },
            ]}
            height={200}
            valueFormatter={(v) => v.toFixed(1)}
          />
        </ChartCard>
        <div className="grid grid-cols-2 gap-3">
          {(["Critical", "Warning", "Info"] as const).map((sev) => {
            const n = signals.filter(
              (s) => s.severity === sev && s.state !== "Resolved"
            ).length
            return (
              <div
                key={sev}
                className="flex flex-col justify-between rounded-xl border bg-card p-4"
              >
                <StateBadge state={sev} />
                <p className="mt-3 text-2xl font-semibold tabular-nums">{n}</p>
                <p className="text-xs text-muted-foreground">
                  open signal{n === 1 ? "" : "s"}
                </p>
              </div>
            )
          })}
          <div className="flex flex-col justify-between rounded-xl border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Agents affected
            </span>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {
                new Set(
                  signals
                    .filter((s) => s.state !== "Resolved")
                    .map((s) => s.agentId)
                ).size
              }
            </p>
            <p className="text-xs text-muted-foreground">
              of{" "}
              {
                deployedAgents.filter((a) => a.environment === "production")
                  .length
              }{" "}
              in production
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          value={[state]}
          onValueChange={(v) => v[0] && setState(v[0] as typeof state)}
          aria-label="Filter signals"
        >
          {(["active", "Open", "Acknowledged", "Resolved", "all"] as const).map(
            (v) => (
              <ToggleGroupItem
                key={v}
                value={v}
                size="sm"
                className="text-xs capitalize"
              >
                {v}
              </ToggleGroupItem>
            )
          )}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          Baselines are the trailing 28-day window per agent. PSI above 0.25 or
          a quality drop over 5 points raises Critical.
        </p>
      </div>

      {byAgent.size === 0 ? (
        <EmptyState
          icon={<CheckIcon />}
          title="No drift signals"
          description="Every production agent is within its baseline for inputs, outputs, quality, tools and cost."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {[...byAgent.entries()].map(([agentId, list]) => (
            <section key={agentId} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <AgentChip agentId={agentId} />
                <span className="text-xs text-muted-foreground">
                  {list.length} signal{list.length === 1 ? "" : "s"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  render={<Link href={`/agentops/traces?agent=${agentId}`} />}
                >
                  <RouteIcon /> Traces
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((s) => (
                  <SignalCard key={s.id} signal={s} onUpdate={update} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function SignalCard({
  signal: s,
  onUpdate,
}: {
  signal: DriftSignal
  onUpdate: (id: string, next: DriftState) => void
}) {
  const delta =
    s.baseline === 0 ? 0 : ((s.current - s.baseline) / s.baseline) * 100
  const bad =
    s.kind === "quality" ? s.current < s.baseline : s.current > s.baseline
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        s.severity === "Critical" &&
          s.state === "Open" &&
          "border-destructive/40",
        s.state === "Resolved" && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {kindLabel[s.kind]}
            <span aria-hidden>·</span>
            {timeAgo(s.detected)}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold">{s.metric}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StateBadge state={s.severity} size="sm" />
          <StateBadge state={s.state} size="sm" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {fmtVal(s.baseline, s.unit)}
          </span>
          <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          <span
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              bad ? "text-danger-text" : "text-success-text"
            )}
          >
            {fmtVal(s.current, s.unit)}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 font-mono text-[10px]",
              bad
                ? "border-destructive/30 text-danger-text"
                : "border-success/30 text-success-text"
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(0)}%
          </Badge>
        </div>
        <Sparkline
          data={s.history}
          className="ml-auto h-8 w-28"
          color={bad ? "var(--destructive)" : "var(--chart-1)"}
          baseline={s.baseline}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {s.explanation}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {s.state === "Open" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdate(s.id, "Acknowledged")}
          >
            <BellOffIcon /> Acknowledge
          </Button>
        )}
        {s.state !== "Resolved" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(s.id, "Resolved")}
          >
            <CheckIcon /> Resolve
          </Button>
        )}
        {s.kind !== "cost" && s.state !== "Resolved" && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            render={<Link href="/agentops/experiments" />}
          >
            <FlaskConicalIcon /> Start experiment
          </Button>
        )}
      </div>
    </article>
  )
}
