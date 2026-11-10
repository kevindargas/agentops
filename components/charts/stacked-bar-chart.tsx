"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import {
  CHART_MARGIN,
  ChartEmpty,
  Y_AXIS_WIDTH,
  axisTick,
  barCursor,
  compactNumber,
  gridStroke,
} from "./chart-primitives"

export interface StackedSeries {
  key: string
  label: string
  color: string
}

/**
 * Stacked columns, one stack per category. Segments are separated by a 2px
 * surface gap (not a stroke colour), the top segment gets 4px rounded corners,
 * horizontal hairline grid only, compact tabular ticks, legend for 2+ series,
 * one tooltip listing every segment plus the stack total.
 */
export function StackedBarChart({
  data,
  series,
  xKey = "name",
  height = 240,
  className,
  valueFormatter,
  xTickFormatter,
  showTotal = true,
  maxBarSize = 28,
}: {
  data: Record<string, string | number>[]
  series: StackedSeries[]
  xKey?: string
  height?: number
  className?: string
  valueFormatter?: (v: number) => string
  xTickFormatter?: (v: string) => string
  /** Show the stack total in the tooltip header. */
  showTotal?: boolean
  maxBarSize?: number
}) {
  if (data.length === 0) return <ChartEmpty height={height} />

  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString())
  const legend = series.length > 1

  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-auto w-full"}
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={CHART_MARGIN}
        barCategoryGap="30%"
      >
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={axisTick}
          tickFormatter={xTickFormatter}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          tickMargin={6}
          allowDecimals={false}
          tick={axisTick}
          tickFormatter={(v: number) => compactNumber(v)}
        />
        <ChartTooltip
          cursor={barCursor}
          content={
            <ChartTooltipContent
              labelFormatter={(label, payload) => {
                const total =
                  payload?.reduce((acc, p) => acc + Number(p.value ?? 0), 0) ??
                  0
                return (
                  <div className="flex items-center justify-between gap-4">
                    <span>
                      {xTickFormatter
                        ? xTickFormatter(String(label))
                        : String(label)}
                    </span>
                    {showTotal && (
                      <span className="text-muted-foreground tabular-nums">
                        {fmt(total)}
                      </span>
                    )}
                  </div>
                )
              }}
              formatter={(value, name, item) => (
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ background: item.color }}
                  />
                  <span className="flex-1 text-muted-foreground">
                    {config[String(name)]?.label ?? name}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {fmt(Number(value))}
                  </span>
                </>
              )}
            />
          }
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={`var(--color-${s.key})`}
            stroke="var(--card)"
            strokeWidth={1}
            maxBarSize={maxBarSize}
            isAnimationActive={false}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
        {legend && (
          <ChartLegend
            verticalAlign="top"
            align="right"
            content={
              <ChartLegendContent className="justify-end pt-0 pb-2 text-xs text-muted-foreground" />
            }
          />
        )}
      </BarChart>
    </ChartContainer>
  )
}
