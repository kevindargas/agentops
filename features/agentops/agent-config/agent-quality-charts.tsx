"use client"

import { ChartCard } from "@/components/charts/chart-card"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { formatNumber } from "@/lib/format"

/** Type alias (not interface) so it satisfies the chart's index-signature data type. */
export type QualityPoint = {
  name: string
  quality: number
  requests: number
}

/**
 * Quality + traffic trend charts for an agent record. Client-side so the
 * value formatters stay out of the server → client prop boundary.
 */
export function AgentQualityCharts({ series }: { series: QualityPoint[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Quality score"
        description="Daily evaluator composite, last 14 days"
      >
        <IncidentTrendChart
          data={series}
          series={[
            { key: "quality", label: "Quality", color: "var(--chart-1)" },
          ]}
          height={200}
          showLegend={false}
          valueFormatter={(v) => v.toFixed(1)}
        />
      </ChartCard>
      <ChartCard title="Traffic" description="Requests per day, last 14 days">
        <IncidentTrendChart
          data={series}
          series={[
            { key: "requests", label: "Requests", color: "var(--chart-5)" },
          ]}
          height={200}
          showLegend={false}
          valueFormatter={(v) => formatNumber(v)}
        />
      </ChartCard>
    </div>
  )
}
