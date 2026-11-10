import { cn } from "cn"
import { BarChart3Icon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/format"

/**
 * Shared chart tokens so every card's plot area lines up. Cartesian charts use
 * the same left/right margin and y-axis width, so axes align across a grid of
 * cards regardless of which chart type sits inside.
 */
export const CHART_MARGIN = { top: 12, right: 12, bottom: 0, left: 0 } as const
export const Y_AXIS_WIDTH = 32

/**
 * Named plot heights so cards in the same row share a baseline. Pass
 * `height={CHART_HEIGHT.md}` instead of an ad hoc pixel value.
 */
export const CHART_HEIGHT = { sm: 180, md: 240, lg: 280 } as const

/** Recessive, muted axis ticks with aligned digits. */
export const axisTick = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
} as const

/** One-step-off-surface hairline, never dashed. */
export const gridStroke = "var(--border)"

/** Hover cursor for bar charts: a soft wash behind the active band. */
export const barCursor = {
  fill: "var(--muted)",
  fillOpacity: 0.5,
  radius: 4,
} as const

/** Hover cursor for line/area charts: a hairline crosshair. */
export const lineCursor = {
  stroke: "var(--muted-foreground)",
  strokeOpacity: 0.35,
  strokeWidth: 1,
} as const

/** Compact axis numbers: 0 / 1K / 2.4M. Same output as `formatNumber(v, true)`. */
export function compactNumber(v: number) {
  return formatNumber(v, true)
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/** Stable, CSS-safe id for SVG gradient defs. */
export function gradientId(prefix: string, key: string) {
  return `${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

/** Placeholder shown while chart data is loading. Matches the card's plot footprint. */
export function ChartSkeleton({
  height = CHART_HEIGHT.md,
  className,
  bars = 7,
}: {
  height?: number
  className?: string
  bars?: number
}) {
  const heights = [55, 72, 40, 86, 64, 48, 78, 60, 70, 44]
  return (
    <div
      className={cn("flex w-full items-end gap-2 px-1 pb-6", className)}
      style={{ height }}
      aria-hidden
    >
      {Array.from({ length: bars }, (_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${heights[i % heights.length]}%` }}
        />
      ))}
    </div>
  )
}

/** Empty case when a chart has no rows. Same footprint as the plot it replaces. */
export function ChartEmpty({
  height = CHART_HEIGHT.md,
  title = "No data",
  description,
  className,
}: {
  height?: number
  title?: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-center",
        className
      )}
      style={{ height }}
    >
      <BarChart3Icon className="size-4 text-muted-foreground/70" />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
