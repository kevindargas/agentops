"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarRangeIcon,
  CoinsIcon,
  DatabaseZapIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"

import { AvailabilityBar } from "@/components/charts/availability-bar"
import { ChartCard } from "@/components/charts/chart-card"
import { DonutChart } from "@/components/charts/donut-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { StatCard } from "@/components/shared/stat-card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { deployedAgents } from "@/lib/data"
import {
  budgets,
  costByAgent,
  costDaily,
  forecastMonthEnd,
  monthlyBudgetTotal,
  monthToDateSpend,
} from "@/lib/data/costs"
import { getProvider } from "@/lib/data/providers"
import { formatCurrency, formatDelta, formatNumber } from "@/lib/format"
import { fmtTokens, modelDisplayName } from "../shared"
import { fmtUsd, periodPace } from "./shared"

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const sum = (
  rows: typeof costDaily,
  k: (d: (typeof costDaily)[number]) => number
) => rows.reduce((s, d) => s + k(d), 0)

/** Top-4 keys by total plus an "Other" bucket so the stack stays ≤ 5 series. */
function stackSeries(
  pick: (d: (typeof costDaily)[number]) => Record<string, number>,
  label: (key: string) => string
) {
  const totals = new Map<string, number>()
  for (const d of costDaily)
    for (const [k, v] of Object.entries(pick(d)))
      totals.set(k, (totals.get(k) ?? 0) + v)
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const top = ranked.slice(0, 4).map(([k]) => k)
  const rest = ranked.slice(4).map(([k]) => k)
  const series = top.map((k, i) => ({
    key: k,
    label: label(k),
    color: palette[i],
  }))
  if (rest.length)
    series.push({ key: "other", label: "Other", color: palette[4] })
  const data = costDaily.map((d) => {
    const row: Record<string, string | number> = { name: d.name }
    const src = pick(d)
    for (const k of top) row[k] = Math.round((src[k] ?? 0) * 100) / 100
    if (rest.length)
      row.other =
        Math.round(rest.reduce((s, k) => s + (src[k] ?? 0), 0) * 100) / 100
    return row
  })
  return { series, data }
}

export function CostsOverview() {
  const [stackBy, setStackBy] = React.useState<"agent" | "provider">("agent")

  const today = costDaily[costDaily.length - 1]
  const yesterday = costDaily[costDaily.length - 2]
  const last7 = costDaily.slice(-7)
  const prev7 = costDaily.slice(-14, -7)
  const forecast = forecastMonthEnd()
  const mtdPct = (monthToDateSpend / monthlyBudgetTotal) * 100
  const pace = periodPace("monthly")

  const per1k = (rows: typeof costDaily) =>
    (sum(rows, (d) => d.cost) /
      Math.max(
        1,
        sum(rows, (d) => d.requests)
      )) *
    1000
  const per1kNow = per1k(last7)
  const per1kDelta = ((per1kNow - per1k(prev7)) / per1k(prev7)) * 100

  const saved7 = sum(last7, (d) => d.cachedSavings)
  const cachedPct = (saved7 / (sum(last7, (d) => d.cost) + saved7)) * 100
  const savedPrev = sum(prev7, (d) => d.cachedSavings)
  const cachedPrevPct =
    (savedPrev / (sum(prev7, (d) => d.cost) + savedPrev)) * 100

  const mover = [...costByAgent].sort(
    (a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)
  )[0]
  const moverAgent = deployedAgents.find((a) => a.id === mover?.agentId)

  const stack = React.useMemo(
    () =>
      stackBy === "agent"
        ? stackSeries(
            (d) => d.byAgent,
            (k) => deployedAgents.find((a) => a.id === k)?.name ?? k
          )
        : stackSeries(
            (d) => d.byProvider,
            (k) => getProvider(k)?.name ?? k
          ),
    [stackBy]
  )

  const byModel = new Map<string, number>()
  for (const a of costByAgent)
    byModel.set(a.modelId, (byModel.get(a.modelId) ?? 0) + a.cost)
  const donut = [...byModel.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, v], i) => ({
      key: m.replace(/[^a-z0-9]/gi, "-"),
      label: modelDisplayName(m),
      value: Math.round(v),
      color: palette[Math.min(i, palette.length - 1)],
    }))

  const exceeded = budgets.filter((b) => b.status === "Exceeded").length
  const atRisk = budgets.filter((b) => b.status === "At risk").length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          size="sm"
          label="Spend today"
          value={fmtUsd(today.cost)}
          delta={((today.cost - yesterday.cost) / yesterday.cost) * 100}
          upIsGood={false}
          deltaLabel="vs yesterday (partial day)"
          icon={<CoinsIcon />}
          sparkline={
            <Sparkline
              data={costDaily.slice(-14).map((d) => d.cost)}
              color="var(--chart-2)"
            />
          }
        />
        <StatCard
          size="sm"
          label="Month to date"
          value={formatCurrency(monthToDateSpend)}
          unit={`/ ${formatCurrency(monthlyBudgetTotal, true)}`}
          icon={<WalletIcon />}
          hint={`${Math.round(mtdPct)}% of team budgets · ${Math.round(pace)}% of month elapsed`}
        >
          <AvailabilityBar
            value={mtdPct}
            target={pace}
            tone={mtdPct > pace * 1.1 ? "warning" : "brand"}
            size="sm"
            className="w-full"
          />
        </StatCard>
        <StatCard
          size="sm"
          label="Forecast · end of month"
          value={formatCurrency(forecast)}
          delta={((forecast - monthlyBudgetTotal) / monthlyBudgetTotal) * 100}
          upIsGood={false}
          deltaLabel="vs team budgets"
          icon={<CalendarRangeIcon />}
          hint={
            exceeded + atRisk > 0
              ? `${exceeded} budget${exceeded === 1 ? "" : "s"} exceeded · ${atRisk} at risk`
              : "All budgets on track"
          }
        />
        <StatCard
          size="sm"
          label="Cost / 1K requests"
          value={fmtUsd(per1kNow)}
          delta={per1kDelta}
          upIsGood={false}
          deltaLabel="vs prior week"
          icon={<ReceiptIcon />}
          hint={`${formatNumber(
            sum(last7, (d) => d.requests),
            true
          )} requests · 7d`}
        />
        <StatCard
          size="sm"
          label="Cached-token savings"
          value={cachedPct.toFixed(1)}
          unit="%"
          delta={cachedPct - cachedPrevPct}
          deltaUnit="pt"
          deltaLabel="vs prior week"
          icon={<DatabaseZapIcon />}
          hint={`${formatCurrency(saved7)} saved this week · ${fmtTokens(sum(last7, (d) => d.tokensCached))} cache reads`}
        />
        <StatCard
          size="sm"
          label="Top mover · week over week"
          value={
            mover ? (
              <Link
                href={`/agentops/agents/${mover.agentId}`}
                className="truncate text-xl hover:underline"
              >
                {moverAgent?.name ?? mover.agentId}
              </Link>
            ) : (
              "—"
            )
          }
          delta={mover?.deltaPct}
          upIsGood={false}
          deltaLabel="vs prior week"
          icon={<TrendingUpIcon />}
          hint={
            mover
              ? `${fmtUsd(mover.cost)} this week · ${formatDelta(mover.deltaPct, "%", 1)}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Daily spend"
          description={`Last 30 days, stacked by ${stackBy}`}
          action={
            <ToggleGroup
              value={[stackBy]}
              onValueChange={(v) =>
                v[0] && setStackBy(v[0] as "agent" | "provider")
              }
              aria-label="Stack daily spend by"
            >
              <ToggleGroupItem value="agent" size="sm" className="text-xs">
                Agent
              </ToggleGroupItem>
              <ToggleGroupItem value="provider" size="sm" className="text-xs">
                Provider
              </ToggleGroupItem>
            </ToggleGroup>
          }
        >
          <StackedBarChart
            data={stack.data}
            series={stack.series}
            height={240}
            valueFormatter={(v) => fmtUsd(v)}
          />
        </ChartCard>
        <ChartCard
          title="Spend by model"
          description="Last 7 days across production agents"
        >
          <DonutChart
            data={donut}
            centerLabel="7 days"
            legend="bottom"
            height={180}
            valueFormatter={(v) => formatCurrency(v)}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Tokens"
          description="Input, output and cache reads per day"
        >
          <StackedBarChart
            data={costDaily.map((d) => ({
              name: d.name,
              input: d.tokensIn,
              output: d.tokensOut,
              cached: d.tokensCached,
            }))}
            series={[
              { key: "input", label: "Input", color: "var(--chart-1)" },
              { key: "output", label: "Output", color: "var(--chart-2)" },
              { key: "cached", label: "Cache reads", color: "var(--chart-3)" },
            ]}
            height={220}
            valueFormatter={fmtTokens}
          />
        </ChartCard>
        <ChartCard
          title="Cost per 1K requests"
          description="Fleet blended unit cost, last 30 days"
        >
          <IncidentTrendChart
            data={costDaily.map((d) => ({
              date: d.date,
              cost:
                Math.round((d.cost / Math.max(1, d.requests)) * 1000 * 100) /
                100,
            }))}
            series={[
              {
                key: "cost",
                label: "Cost / 1K requests",
                color: "var(--chart-2)",
              },
            ]}
            height={220}
            showLegend={false}
            valueFormatter={(v) => fmtUsd(v)}
          />
        </ChartCard>
      </div>
    </div>
  )
}
