import { cn } from "cn"

export type MeterTone = "success" | "brand" | "warning" | "danger"

const fillClass: Record<MeterTone, string> = {
  success: "bg-success",
  brand: "bg-brand",
  warning: "bg-warning",
  danger: "bg-destructive",
}

/** Track is a lighter step of the same hue so state reads across the whole bar. */
const trackClass: Record<MeterTone, string> = {
  success: "bg-success/15",
  brand: "bg-brand/15",
  warning: "bg-warning/20",
  danger: "bg-destructive/15",
}

export function toneForScore(
  score: number,
  thresholds: { good: number; ok: number } = { good: 95, ok: 85 }
): MeterTone {
  if (score >= thresholds.good) return "success"
  if (score >= thresholds.ok) return "brand"
  if (score >= thresholds.ok - 10) return "warning"
  return "danger"
}

/**
 * Meter for a single ratio against a limit. Server-safe. The fill carries
 * severity, the track is a lighter step of the same ramp, and an optional
 * target tick marks the SLO so the gap to target is visible at a glance.
 */
export function AvailabilityBar({
  value,
  min = 0,
  max = 100,
  target,
  tone,
  label,
  valueLabel,
  className,
  size = "md",
}: {
  value: number
  /** Zoom the scale, e.g. min=99 for availability so 99.4 vs 99.98 is visible. */
  min?: number
  max?: number
  /** Draws a hairline tick at this value. */
  target?: number
  tone?: MeterTone
  label?: React.ReactNode
  valueLabel?: React.ReactNode
  className?: string
  size?: "sm" | "md"
}) {
  const t = tone ?? toneForScore(value)
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const targetPct =
    target === undefined
      ? undefined
      : Math.max(0, Math.min(100, ((target - min) / (max - min)) * 100))
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            {label}
          </span>
          <span className="font-medium tabular-nums">{valueLabel}</span>
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full",
          size === "sm" ? "h-1.5" : "h-2",
          trackClass[t]
        )}
        role="meter"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className={cn("h-full rounded-full", fillClass[t])}
          style={{ width: `${pct}%` }}
        />
        {targetPct !== undefined && (
          <span
            className="absolute inset-y-0 w-px bg-foreground/50"
            style={{ left: `${targetPct}%` }}
            aria-hidden
            title={`Target ${target}`}
          />
        )}
      </div>
    </div>
  )
}
