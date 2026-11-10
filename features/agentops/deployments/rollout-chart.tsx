"use client"

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
  gradientId,
  gridStroke,
  lineCursor,
} from "@/components/charts/chart-primitives"
import type { RolloutPoint } from "@/lib/data/deployments"

export interface RolloutSeries {
  key: keyof Omit<RolloutPoint, "at">
  label: string
  color: string
  /** `step` draws a stepped area (traffic share); `line` a 2px line. */
  kind?: "step" | "line"
  dashed?: boolean
}

function tickTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    timeZone: "UTC",
  })
}

function fullTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

/**
 * Canary timeline: one y-axis (0–100 for traffic + quality, or error rate in
 * percent), stepped traffic area under 2px metric lines, legend for 2+ series.
 */
export function RolloutChart({
  points,
  series,
  height = 220,
  domain,
  valueFormatter,
  className,
}: {
  points: RolloutPoint[]
  series: RolloutSeries[]
  height?: number
  domain?: [number | "auto", number | "auto"]
  valueFormatter?: (v: number, key: string) => string
  className?: string
}) {
  if (points.length === 0)
    return (
      <ChartEmpty
        height={height}
        description="The rollout has not started yet."
      />
    )
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig
  const fmt =
    valueFormatter ??
    ((v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }))

  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-auto w-full"}
      style={{ height }}
    >
      <ComposedChart accessibilityLayer data={points} margin={CHART_MARGIN}>
        <defs>
          {series
            .filter((s) => s.kind === "step")
            .map((s) => (
              <linearGradient
                key={s.key}
                id={gradientId("rollout", s.key)}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={`var(--color-${s.key})`}
                  stopOpacity={0.25}
                />
                <stop
                  offset="100%"
                  stopColor={`var(--color-${s.key})`}
                  stopOpacity={0.03}
                />
              </linearGradient>
            ))}
        </defs>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey="at"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={48}
          tick={axisTick}
          tickFormatter={(v: string) => tickTime(v)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          tickMargin={6}
          domain={domain}
          tick={axisTick}
        />
        <ChartTooltip
          cursor={lineCursor}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(v) => fullTime(String(v))}
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
                    {fmt(Number(value), String(name))}
                  </span>
                </>
              )}
            />
          }
        />
        {series.map((s) =>
          s.kind === "step" ? (
            <Area
              key={s.key}
              dataKey={s.key}
              type="stepAfter"
              stroke={`var(--color-${s.key})`}
              strokeWidth={1.5}
              fill={`url(#${gradientId("rollout", s.key)})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          ) : (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "4 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          )
        )}
        {series.length > 1 && (
          <ChartLegend
            verticalAlign="top"
            align="right"
            content={
              <ChartLegendContent className="justify-end pt-0 pb-2 text-xs text-muted-foreground" />
            }
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}
