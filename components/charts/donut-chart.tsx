"use client"

import { cn } from "cn"
import { Cell, Label, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { ChartEmpty } from "./chart-primitives"

export interface DonutDatum {
  key: string
  label: string
  value: number
  color: string
}

/**
 * Part-to-whole donut (<= 6 segments). Centered total, 2px surface gaps
 * between segments, and a legend that doubles as the table view: label,
 * value and share for every slice so nothing is colour-only.
 */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 220,
  className,
  legend = "right",
  valueFormatter,
}: {
  data: DonutDatum[]
  centerLabel?: string
  /** Defaults to the formatted sum of all values. */
  centerValue?: string
  height?: number
  className?: string
  legend?: "right" | "bottom" | "none"
  valueFormatter?: (v: number) => string
}) {
  if (data.length === 0) return <ChartEmpty height={height} />

  const config = Object.fromEntries(
    data.map((d) => [d.key, { label: d.label, color: d.color }])
  ) satisfies ChartConfig
  const total = data.reduce((acc, d) => acc + d.value, 0)
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString())
  const center = centerValue ?? fmt(total)

  return (
    <div
      className={cn(
        "flex w-full gap-4",
        legend === "bottom"
          ? "flex-col"
          : "flex-col sm:flex-row sm:items-center",
        className
      )}
    >
      <ChartContainer
        config={config}
        className="mx-auto aspect-square w-full max-w-full shrink-0"
        style={{ height, width: legend === "right" ? height : undefined }}
      >
        <PieChart
          accessibilityLayer
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="key"
                hideLabel
                formatter={(value, name, item) => (
                  <>
                    <span
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ background: item.payload?.fill ?? item.color }}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {config[String(name)]?.label ?? name}
                    </span>
                    <span className="font-medium text-foreground tabular-nums">
                      {fmt(Number(value))}{" "}
                      <span className="font-normal text-muted-foreground">
                        ·{" "}
                        {total ? Math.round((Number(value) / total) * 100) : 0}%
                      </span>
                    </span>
                  </>
                )}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
            cornerRadius={3}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={`var(--color-${d.key})`} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox))
                  return null
                const { cx, cy } = viewBox as { cx: number; cy: number }
                return (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={cx}
                      y={centerLabel ? cy - 6 : cy}
                      className="fill-foreground text-2xl font-semibold"
                    >
                      {center}
                    </tspan>
                    {centerLabel && (
                      <tspan
                        x={cx}
                        y={cy + 14}
                        className="fill-muted-foreground text-xs"
                      >
                        {centerLabel}
                      </tspan>
                    )}
                  </text>
                )
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      {legend !== "none" && (
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2.5">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: d.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {d.label}
              </span>
              <span className="font-medium tabular-nums">{fmt(d.value)}</span>
              <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
