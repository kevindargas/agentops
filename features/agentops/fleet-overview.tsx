"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  BotIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  FlaskConicalIcon,
  LightbulbIcon,
  SparklesIcon,
  WavesIcon,
  ZapIcon,
} from "lucide-react"

import { ChartCard } from "@/components/charts/chart-card"
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { StatCard } from "@/components/shared/stat-card"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  deployedAgents,
  driftSignals,
  experiments,
  fleetDaily,
  modelRecommendations,
  reviewItems,
} from "@/lib/data"
import { formatCurrency, formatNumber, timeAgo } from "@/lib/format"
import { AgentChip, fmtMs, FrameworkBadge, ModelChip, ScoreBar } from "./shared"

export function FleetOverview() {
  const live = deployedAgents.filter((a) => a.environment === "production")
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
  const pending = reviewItems.filter((r) => r.status === "Pending").length
  const openDrift = driftSignals.filter((d) => d.state !== "Resolved")
  const running = experiments.filter((e) => e.status === "Running")
  const openRecs = modelRecommendations.filter(
    (r) => r.status === "New" || r.status === "Testing"
  )
  const unhealthy = live.filter((a) => a.health !== "Healthy")
  const last7 = fleetDaily.slice(-7),
    prev7 = fleetDaily.slice(-14, -7)
  const sum = (rows: typeof fleetDaily, k: "requests" | "cost") =>
    rows.reduce((s, r) => s + r[k], 0)
  const reqDelta =
    ((sum(last7, "requests") - sum(prev7, "requests")) /
      sum(prev7, "requests")) *
    100
  const costDelta =
    ((sum(last7, "cost") - sum(prev7, "cost")) / sum(prev7, "cost")) * 100
  const qDelta =
    last7.reduce((s, r) => s + r.quality, 0) / 7 -
    prev7.reduce((s, r) => s + r.quality, 0) / 7

  const byModel = new Map<string, number>()
  for (const a of live)
    byModel.set(a.modelId, (byModel.get(a.modelId) ?? 0) + a.metrics.costPerDay)
  const costByModel = [...byModel.entries()]
    .map(([m, v]) => ({
      name: m
        .split("/")
        .pop()!
        .replace(/-preview$/, ""),
      value: Math.round(v),
    }))
    .sort((a, b) => b.value - a.value)

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
                  ({a.health.toLowerCase()})
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Requests · 24h"
          value={formatNumber(requests, true)}
          delta={reqDelta}
          deltaLabel="vs prior week"
          icon={<ZapIcon />}
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
          deltaLabel="vs prior week"
          icon={<SparklesIcon />}
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
          delta={costDelta}
          upIsGood={false}
          deltaLabel="vs prior week"
          icon={<CoinsIcon />}
          hint={`≈ ${formatCurrency(cost * 30, true)} / month at current traffic`}
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
          icon={<ClipboardCheckIcon />}
          hint={`${openDrift.length} drift signals · ${running.length} experiments running`}
          href="/agentops/reviews"
        />
      </div>

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
            height={220}
            valueFormatter={(v) => formatNumber(v, true)}
            xTickFormatter={(v) => v.replace(/^(\w{3}) /, "$1 ")}
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
            height={220}
            showLegend={false}
            valueFormatter={(v) => v.toFixed(1)}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold">Agents</h2>
              <p className="text-xs text-muted-foreground">
                Production fleet by traffic
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/agentops/agents" />}
            >
              All agents <ArrowRightIcon />
            </Button>
          </div>
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
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <FrameworkBadge
                          framework={a.framework}
                          className="h-4 px-1 text-[10px]"
                        />
                        <ModelChip
                          modelId={a.modelId}
                          className="text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                  <span className="hidden text-right font-mono text-xs text-muted-foreground tabular-nums sm:block">
                    {formatNumber(a.metrics.requests24h)} req
                  </span>
                  <span className="hidden text-right font-mono text-xs text-muted-foreground tabular-nums sm:block">
                    p95 {fmtMs(a.metrics.p95Ms)}
                  </span>
                  <ScoreBar
                    value={a.metrics.quality}
                    className="hidden sm:inline-flex"
                  />
                  <StateBadge state={a.health} size="sm" />
                </li>
              ))}
          </ul>
        </section>

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
          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-semibold">Needs a decision</h2>
              <Badge
                variant="outline"
                className="text-muted-foreground tabular-nums"
              >
                {openRecs.length + running.length}
              </Badge>
            </div>
            <ul className="divide-y">
              {openRecs.slice(0, 2).map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-warning-text" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/agentops/recommendations"
                      className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
          </section>
        </div>
      </div>
    </div>
  )
}
