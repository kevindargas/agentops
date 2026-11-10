"use client"

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { ChartEmpty, axisTick, barCursor } from "./chart-primitives"

export interface BarDatum {
  name: string
  value: number
  fill?: string
}

/**
 * Single-series horizontal bar chart. One hue (no legend needed), 4px rounded
 * data end, square at the baseline, value labels at the tip, optional emphasis
 * of one row (the rest fall back to a muted wash).
 */
export function HorizontalBarChart({
  data,
  label = "Count",
  color = "var(--chart-1)",
  height,
  valueFormatter,
  labelWidth = 132,
  rowHeight = 32,
  emphasize,
  showValues = true,
  className,
  emptyDescription,
}: {
  data: BarDatum[]
  label?: string
  color?: string
  /** Fixed height. When omitted, height grows with the row count. */
  height?: number
  valueFormatter?: (v: number) => string
  labelWidth?: number
  /** Per-row height used when `height` is not fixed. */
  rowHeight?: number
  /** Name of the row to highlight; other rows render in a muted wash. */
  emphasize?: string
  showValues?: boolean
  className?: string
  emptyDescription?: string
}) {
  const resolvedHeight = height ?? Math.max(96, data.length * rowHeight + 8)
  if (data.length === 0)
    return <ChartEmpty height={resolvedHeight} description={emptyDescription} />

  const config = { value: { label, color } } satisfies ChartConfig
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString())
  const max = Math.max(...data.map((d) => d.value), 0)

  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-auto w-full"}
      style={{ height: resolvedHeight }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 44, top: 2, bottom: 2 }}
        barCategoryGap={6}
      >
        <XAxis type="number" hide domain={[0, Math.max(1, max)]} />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          width={labelWidth}
          tickMargin={8}
          tick={{ ...axisTick, fontSize: 12, fill: "var(--foreground)" }}
          interval={0}
        />
        <ChartTooltip
          cursor={barCursor}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, name) => (
                <>
                  <span className="flex-1 text-muted-foreground">
                    {config[String(name) as keyof typeof config]?.label ??
                      label}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {fmt(Number(value))}
                  </span>
                </>
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          minPointSize={2}
          isAnimationActive={false}
          background={{ fill: "var(--muted)", fillOpacity: 0.35, radius: 4 }}
        >
          {data.map((d) => {
            const muted = emphasize !== undefined && d.name !== emphasize
            return (
              <Cell
                key={d.name}
                fill={
                  d.fill ??
                  (muted ? "var(--muted-foreground)" : "var(--color-value)")
                }
                fillOpacity={muted ? 0.35 : 1}
              />
            )
          })}
          {showValues && (
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              className="fill-foreground text-xs font-medium tabular-nums"
              formatter={(v: unknown) => fmt(Number(v))}
            />
          )}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
