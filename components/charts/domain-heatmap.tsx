import * as React from "react"
import { cn } from "cn"

/** One tile of the heatmap. The tint comes in through `className`. */
export interface HeatmapTile {
  id: string
  /** Heading rendered top-left, e.g. a category chip. */
  label: React.ReactNode
  /** Plain-text name for the accessible label. */
  title: string
  /** 0 to `max`. */
  score: number
  /** Short facts printed under the score, e.g. "9/12 in place". */
  facts: { label: string; value: string }[]
  /** Count shown as a red pill top-right (e.g. release blockers); hidden when 0. */
  alerts?: number
  alertsTitle?: string
  /** Tint classes (background and text) for the score tone. */
  className?: string
}

/**
 * Tiles tinted by score. The number is always printed so the tint is never the
 * only carrier of state.
 */
export function DomainHeatmap({
  tiles,
  max = 100,
  className,
}: {
  tiles: HeatmapTile[]
  max?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3",
        className
      )}
    >
      {tiles.map((t) => {
        const alerts = t.alerts ?? 0
        const facts = t.facts.map((f) => `${f.value} ${f.label}`).join(", ")
        return (
          <div
            key={t.id}
            className={cn(
              "flex min-h-28 flex-col justify-between gap-2 rounded-lg p-3 ring-1 ring-foreground/5 ring-inset print:break-inside-avoid",
              t.className
            )}
            aria-label={`${t.title}: ${t.score} of ${max}${facts ? `, ${facts}` : ""}${alerts > 0 ? `, ${alerts} ${t.alertsTitle ?? "alerts"}` : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              {t.label}
              {alerts > 0 && (
                <span
                  className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1.5 text-3xs leading-none font-semibold text-destructive-foreground tabular-nums"
                  title={`${alerts} ${t.alertsTitle ?? "alerts"}`}
                >
                  {alerts}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {t.score}
              </span>
              <span className="text-2xs font-medium opacity-70">/{max}</span>
            </div>
            {t.facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-2 text-2xs leading-tight text-foreground/80">
                {t.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="sr-only">{f.label}</dt>
                    <dd className="tabular-nums">
                      <span className="font-medium text-foreground">
                        {f.value}
                      </span>{" "}
                      {f.label}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )
      })}
    </div>
  )
}
