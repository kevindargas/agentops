import { cn } from "cn"

export type UptimeStatus = "up" | "degraded" | "down" | "none"

export interface UptimeDay {
  /** ISO date, used for the tooltip. */
  date: string
  status: UptimeStatus
  /** Optional detail, e.g. "99.2% · 2 alerts". */
  note?: string
}

const statusClass: Record<UptimeStatus, string> = {
  up: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  none: "bg-muted",
}

const statusLabel: Record<UptimeStatus, string> = {
  up: "Operational",
  degraded: "Degraded",
  down: "Outage",
  none: "No data",
}

/**
 * Status-page style strip: one slim bar per day, status colour, hairline gaps.
 * Server-safe (no hooks). Native tooltips carry the per-day detail; the
 * caption carries the summary so the strip is never colour-only.
 */
export function UptimeStrip({
  days,
  className,
  caption = true,
  size = "md",
}: {
  days: UptimeDay[]
  className?: string
  /** Show the "N days ago → today" caption and summary. */
  caption?: boolean
  size?: "sm" | "md"
}) {
  const up = days.filter((d) => d.status === "up").length
  const pct = days.length ? (up / days.length) * 100 : 0
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className={cn("flex w-full gap-px", size === "sm" ? "h-5" : "h-7")}
        role="img"
        aria-label={`${days.length}-day uptime: ${pct.toFixed(1)}% of days fully operational`}
      >
        {days.map((d) => (
          <span
            key={d.date}
            title={`${new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · ${statusLabel[d.status]}${d.note ? ` · ${d.note}` : ""}`}
            className={cn(
              "flex-1 rounded-[2px] transition-opacity hover:opacity-70",
              statusClass[d.status]
            )}
          />
        ))}
      </div>
      {caption && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{days.length} days ago</span>
          <span>
            {up} of {days.length} days operational
          </span>
          <span>Today</span>
        </div>
      )}
    </div>
  )
}
