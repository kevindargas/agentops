"use client"

import {
  type BarDatum,
  HorizontalBarChart,
} from "@/components/charts/horizontal-bar-chart"
import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { formatCost, formatNumber } from "@/lib/format"

/**
 * Client wrappers for the dashboard's fleet charts. Formatter functions can't
 * cross the server to client boundary, so the formatting lives here.
 */
export function FleetTrafficChart({
  data,
}: {
  data: Record<string, string | number>[]
}) {
  return (
    <IncidentTrendChart
      data={data}
      series={[
        { key: "requests", label: "Requests", color: "var(--chart-1)" },
        { key: "reviewed", label: "Human reviewed", color: "var(--chart-3)" },
      ]}
      height={CHART_HEIGHT.md}
      valueFormatter={(v) => formatNumber(v, true)}
    />
  )
}

export function SpendByAgentChart({ data }: { data: BarDatum[] }) {
  return (
    <HorizontalBarChart
      data={data}
      label="$ / day"
      height={CHART_HEIGHT.sm}
      labelWidth={130}
      valueFormatter={(v) => formatCost(v, 0)}
    />
  )
}
