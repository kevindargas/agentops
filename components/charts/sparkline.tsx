"use client"

import { Area, AreaChart, ReferenceDot, ReferenceLine, YAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

import { gradientId } from "./chart-primitives"

/**
 * 12 to 30 point trend for stat tiles. 1.5px line, soft gradient wash, end-dot
 * with a surface ring, optional baseline (e.g. an SLO target). No axes, no
 * tooltip; the tile's value and delta carry the numbers.
 */
export function Sparkline({
  data,
  color = "var(--chart-1)",
  className,
  baseline,
  showArea = true,
  showEndDot = true,
  strokeWidth = 1.5,
  domain,
}: {
  data: number[]
  color?: string
  className?: string
  /** Horizontal reference, drawn as a hairline. */
  baseline?: number
  showArea?: boolean
  showEndDot?: boolean
  strokeWidth?: number
  /** Fix the y-domain, e.g. [90, 100] for availability. */
  domain?: [number, number]
}) {
  const config = { v: { label: "Value", color } } satisfies ChartConfig
  const points = data.map((v, i) => ({ i, v }))
  const last = points[points.length - 1]
  const id = gradientId("spark", color)
  return (
    <ChartContainer
      config={config}
      className={className ?? "h-8 w-24"}
      aria-hidden
    >
      <AreaChart
        data={points}
        margin={{ top: 4, bottom: 2, left: 2, right: 5 }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-v)"
              stopOpacity={showArea ? 0.24 : 0}
            />
            <stop offset="100%" stopColor="var(--color-v)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={domain ?? ["auto", "auto"]} />
        {baseline !== undefined && (
          <ReferenceLine
            y={baseline}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.4}
            strokeWidth={1}
            ifOverflow="extendDomain"
          />
        )}
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={`url(#${id})`}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        {showEndDot && last && (
          <ReferenceDot
            x={last.i}
            y={last.v}
            r={3}
            fill="var(--color-v)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        )}
      </AreaChart>
    </ChartContainer>
  )
}
