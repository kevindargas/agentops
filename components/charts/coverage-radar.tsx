"use client"

import { cn } from "cn"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { CHART_HEIGHT, axisTick, gridStroke } from "./chart-primitives"

/** One spoke of the radar. `short` is the axis label, `title` the tooltip. */
export interface RadarPoint {
  id: string
  short: string
  title: string
  /** 0 to `max`. */
  score: number
}

/**
 * Score per category on a radar. One hue for the current series; an optional
 * second, muted dashed outline for a comparison (e.g. a snapshot). Legend only
 * appears when two series are drawn.
 */
export function CoverageRadar({
  domains,
  compare,
  label = "Current",
  compareLabel = "Snapshot",
  max = 100,
  height = CHART_HEIGHT.lg,
  className,
}: {
  domains: RadarPoint[]
  compare?: RadarPoint[]
  /** Legend / tooltip label for the main series. */
  label?: string
  /** Legend / tooltip label for the comparison series. */
  compareLabel?: string
  /** Upper bound of the radial axis. */
  max?: number
  height?: number
  className?: string
}) {
  const compareById = new Map((compare ?? []).map((d) => [d.id, d.score]))
  const data = domains.map((d) => ({
    id: d.id,
    short: d.short,
    title: d.title,
    score: d.score,
    ...(compare ? { compare: compareById.get(d.id) ?? 0 } : {}),
  }))

  const config = {
    score: { label, color: "var(--chart-1)" },
    compare: { label: compareLabel, color: "var(--muted-foreground)" },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto w-full", className)}
      style={{ height }}
    >
      <RadarChart
        accessibilityLayer
        data={data}
        margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
        outerRadius="78%"
      >
        <PolarGrid stroke={gridStroke} />
        <PolarAngleAxis dataKey="short" tick={axisTick} tickLine={false} />
        <PolarRadiusAxis
          domain={[0, max]}
          tickCount={5}
          axisLine={false}
          tick={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelKey="title"
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  (typeof data)[number] | undefined
                return row ? row.title : null
              }}
              formatter={(value, name, item) => (
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ background: item.color }}
                  />
                  <span className="flex-1 text-muted-foreground">
                    {config[String(name) as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {Number(value)}
                    <span className="text-muted-foreground">/{max}</span>
                  </span>
                </>
              )}
            />
          }
        />
        {compare && (
          <Radar
            dataKey="compare"
            name="compare"
            stroke="var(--color-compare)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="var(--color-compare)"
            fillOpacity={0.06}
            dot={false}
            isAnimationActive={false}
          />
        )}
        <Radar
          dataKey="score"
          name="score"
          stroke="var(--color-score)"
          strokeWidth={2}
          fill="var(--color-score)"
          fillOpacity={0.25}
          dot={{ r: 3, fill: "var(--color-score)", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
        />
        {compare && (
          <ChartLegend
            verticalAlign="bottom"
            content={
              <ChartLegendContent className="pt-2 text-xs text-muted-foreground" />
            }
          />
        )}
      </RadarChart>
    </ChartContainer>
  )
}
