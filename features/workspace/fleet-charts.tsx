"use client"

import {
  type BarDatum,
  HorizontalBarChart,
} from "@/components/charts/horizontal-bar-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { fmtCost } from "@/features/agentops/format"
import { formatNumber } from "@/lib/format"

/**
 * Client wrappers for the dashboard's fleet charts. Formatter functions can't
 * cross the server → client boundary, so the formatting lives here.
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
      height={248}
      valueFormatter={(v) => formatNumber(v, true)}
    />
  )
}

export function SpendByAgentChart({ data }: { data: BarDatum[] }) {
  return (
    <HorizontalBarChart
      data={data}
      label="$ / day"
      height={200}
      labelWidth={130}
      valueFormatter={(v) => fmtCost(v, 0)}
    />
  )
}
