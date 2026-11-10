"use client"

import { cn } from "cn"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts"

import { axisTick, gridStroke } from "@/components/charts/chart-primitives"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DomainScore } from "@/lib/readiness/types"
import { DomainChip, scoreSoftClass, scoreTone } from "./shared"

/**
 * Coverage per domain on a 0–100 radar. One hue for the current assessment;
 * an optional second, muted dashed outline for a snapshot to compare with.
 * Legend only appears when two series are drawn.
 */
export function CoverageRadar({
  domains,
  compare,
  compareLabel = "Snapshot",
  height = 280,
  className,
}: {
  domains: DomainScore[]
  compare?: DomainScore[]
  /** Legend / tooltip label for the comparison series. */
  compareLabel?: string
  height?: number
  className?: string
}) {
  const compareById = new Map(
    (compare ?? []).map((d) => [d.domain.id, d.score])
  )
  const data = domains.map((d) => ({
    id: d.domain.id,
    short: d.domain.short,
    title: d.domain.title,
    score: d.score,
    ...(compare ? { compare: compareById.get(d.domain.id) ?? 0 } : {}),
  }))

  const config = {
    score: { label: "Current", color: "var(--chart-1)" },
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
        <PolarAngleAxis
          dataKey="short"
          tick={{ ...axisTick, fontSize: 11 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          domain={[0, 100]}
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
                    <span className="text-muted-foreground">/100</span>
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

/**
 * Six tiles, one per domain, tinted by the score tone. Numbers are always
 * printed so the tint is never the only carrier of state.
 */
export function DomainHeatmap({
  domains,
  className,
}: {
  domains: DomainScore[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3",
        className
      )}
    >
      {domains.map((d) => {
        const tone = scoreTone(d.score)
        return (
          <div
            key={d.domain.id}
            className={cn(
              "flex min-h-28 flex-col justify-between gap-2 rounded-lg p-3 ring-1 ring-foreground/5 ring-inset print:break-inside-avoid",
              scoreSoftClass[tone]
            )}
            aria-label={`${d.domain.title}: ${d.score} of 100, ${d.inPlace} of ${d.applicable} in place, ${d.requiredMet} of ${d.required} required met${d.blockers > 0 ? `, ${d.blockers} blockers` : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <DomainChip domain={d.domain} short className="text-foreground" />
              {d.blockers > 0 && (
                <span
                  className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] leading-none font-semibold text-white tabular-nums"
                  title={`${d.blockers} release ${d.blockers === 1 ? "blocker" : "blockers"}`}
                >
                  {d.blockers}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {d.score}
              </span>
              <span className="text-[11px] font-medium opacity-70">/100</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-2 text-[11px] leading-tight text-foreground/80">
              <div>
                <dt className="sr-only">In place</dt>
                <dd className="tabular-nums">
                  <span className="font-medium text-foreground">
                    {d.inPlace}/{d.applicable}
                  </span>{" "}
                  in place
                </dd>
              </div>
              <div>
                <dt className="sr-only">Required met</dt>
                <dd className="tabular-nums">
                  <span className="font-medium text-foreground">
                    {d.requiredMet}/{d.required}
                  </span>{" "}
                  required met
                </dd>
              </div>
            </dl>
          </div>
        )
      })}
    </div>
  )
}
