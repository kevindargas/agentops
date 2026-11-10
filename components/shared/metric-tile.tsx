import { cn } from "cn"

import { Eyebrow } from "@/components/shared/eyebrow"
import { StatDelta } from "@/components/shared/stat-card"
import { toneClasses, type Tone } from "@/components/shared/status-badge"

export interface MetricTileProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Small unit after the value ("ms", "%", "/ 120"). */
  unit?: string
  hint?: React.ReactNode
  /** Tints the value. Defaults to the foreground colour. */
  tone?: Tone
  /** Signed change rendered as a pill; see `StatDelta`. */
  delta?: number
  deltaUnit?: string
  upIsGood?: boolean
  icon?: React.ReactNode
  className?: string
}

/**
 * Compact bordered KPI tile for inside cards, sheets and record sidebars
 * (the `rounded-lg border bg-muted/30 px-3 py-2` pattern). Use `StatCard`
 * for page-level KPI rows; use this when a metric sits inside another surface.
 */
export function MetricTile({
  label,
  value,
  unit,
  hint,
  tone,
  delta,
  deltaUnit,
  upIsGood,
  icon,
  className,
}: MetricTileProps) {
  return (
    <div
      data-slot="metric-tile"
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="span" className="flex items-center gap-1.5 truncate">
          {icon && (
            <span className="inline-flex shrink-0 [&_svg]:size-3.5">
              {icon}
            </span>
          )}
          <span className="truncate">{label}</span>
        </Eyebrow>
        {delta !== undefined && (
          <StatDelta value={delta} unit={deltaUnit} upIsGood={upIsGood} />
        )}
      </div>
      <div
        className={cn(
          "flex items-baseline gap-1 text-lg font-semibold num tracking-tight tabular-nums",
          tone ? toneClasses[tone].text : "text-foreground"
        )}
      >
        {value}
        {unit && (
          <span className="text-xs font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground [&_a]:underline-offset-4 [&_a]:hover:underline">
          {hint}
        </div>
      )}
    </div>
  )
}
