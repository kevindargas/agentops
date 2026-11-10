"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts"

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
  compactNumber,
  gradientId,
  gridStroke,
  lineCursor,
  longDate,
  shortDate,
} from "./chart-primitives"

export interface TrendSeries {
  key: string
  label: string
  color: string
}

const defaultSeries: TrendSeries[] = [
  { key: "opened", label: "Opened", color: "var(--chart-1)" },
  { key: "resolved", label: "Resolved", color: "var(--chart-3)" },
]

/**
 * Multi-series area trend. Soft gradient wash under a 2px line, horizontal
 * hairline grid only, muted tabular ticks, end-dot on the last point of each
 * series, legend for 2+ series, crosshair tooltip listing every series.
 */
export function IncidentTrendChart({
  data,
  series = defaultSeries,
  xKey = "date",
  height = 256,
  className,
  showLegend,
  showEndDots = true,
  valueFormatter,
}: {
  data: Record<string, string | number>[]
  /** Which keys to plot. Defaults to opened/resolved. */
  series?: TrendSeries[]
  xKey?: string
  height?: number
  className?: string
  /** Defaults to true when 2+ series are plotted. */
  showLegend?: boolean
  showEndDots?: boolean
  valueFormatter?: (v: number) => string
}) {
  if (data.length === 0)
    return (
      <ChartEmpty height={height} description="No activity in this period." />
    )

  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig
  const last = data[data.length - 1]
  const legend = showLegend ?? series.length > 1
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString())

  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-auto w-full"}
      style={{ height }}
    >
      <AreaChart accessibilityLayer data={data} margin={CHART_MARGIN}>
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.key}
              id={gradientId("trend", s.key)}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={`var(--color-${s.key})`}
                stopOpacity={0.22}
              />
              <stop
                offset="100%"
                stopColor={`var(--color-${s.key})`}
                stopOpacity={0.01}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
          tick={axisTick}
          tickFormatter={(v: string) => shortDate(v)}
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
          cursor={lineCursor}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(v) => longDate(String(v))}
              formatter={(value, name, item) => (
                <>
                  <span
                    className="h-full w-0.5 shrink-0 rounded-full"
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
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={`url(#${gradientId("trend", s.key)})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        ))}
        {showEndDots &&
          series.map((s) => (
            <ReferenceDot
              key={`${s.key}-end`}
              x={String(last[xKey])}
              y={Number(last[s.key])}
              r={4}
              fill={`var(--color-${s.key})`}
              stroke="var(--card)"
              strokeWidth={2}
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
      </AreaChart>
    </ChartContainer>
  )
}
