import { cn } from "cn"
import { AlertOctagonIcon, CheckCircle2Icon, ClockIcon } from "lucide-react"

import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress"
import { NOW } from "@/lib/data/seed"
import { formatDateTime } from "@/lib/format"

/** Elapsed share of a window anchored to the demo clock, clamped to 0 to 100. */
export function elapsedPercent(start: string, end: string, at: Date = NOW) {
  const total = new Date(end).getTime() - new Date(start).getTime()
  if (total <= 0) return 100
  return Math.min(
    100,
    Math.max(
      0,
      Math.round(((at.getTime() - new Date(start).getTime()) / total) * 100)
    )
  )
}

function remainingLabel(due: string, at: Date = NOW) {
  const hours = (new Date(due).getTime() - at.getTime()) / 3_600_000
  const abs = Math.abs(hours)
  const text =
    abs < 1
      ? `${Math.max(1, Math.round(abs * 60))}m`
      : abs < 48
        ? `${Math.round(abs)}h`
        : `${Math.round(abs / 24)}d`
  return hours < 0 ? `${text} overdue` : `${text} left`
}

/**
 * Deadline progress for SLAs, due dates and maintenance windows.
 * Colors escalate as the window is consumed; completed items show the outcome.
 */
export function SlaProgress({
  label,
  start,
  due,
  completed,
  breached,
  className,
}: {
  label?: string
  start: string
  due: string
  /** ISO timestamp when the work finished, if it has. */
  completed?: string
  breached?: boolean
  className?: string
}) {
  const pct = completed ? 100 : elapsedPercent(start, due)
  const overdue =
    breached || (!completed && new Date(due).getTime() < NOW.getTime())
  const tone = overdue
    ? "danger"
    : completed
      ? "success"
      : pct >= 90
        ? "danger"
        : pct >= 75
          ? "warning"
          : "progress"
  const bar = {
    danger: "bg-destructive",
    success: "bg-success",
    warning: "bg-warning",
    progress: "bg-brand",
  }[tone]
  const text = {
    danger: "text-danger-text",
    success: "text-success-text",
    warning: "text-warning-text",
    progress: "text-muted-foreground",
  }[tone]

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground tabular-nums">
            Due {formatDateTime(due)}
          </span>
        </div>
      )}
      <Progress value={pct} aria-label={label ?? "Progress"} className="gap-0">
        <ProgressTrack className="h-1.5">
          <ProgressIndicator className={cn("rounded-full", bar)} />
        </ProgressTrack>
      </Progress>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {completed
            ? `Completed ${formatDateTime(completed)}`
            : `${pct}% of window used`}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium tabular-nums",
            text
          )}
        >
          {completed ? (
            overdue ? (
              <>
                <AlertOctagonIcon className="size-3.5" /> Breached
              </>
            ) : (
              <>
                <CheckCircle2Icon className="size-3.5" /> Met
              </>
            )
          ) : overdue ? (
            <>
              <AlertOctagonIcon className="size-3.5" /> {remainingLabel(due)}
            </>
          ) : (
            <>
              <ClockIcon className="size-3.5" /> {remainingLabel(due)}
            </>
          )}
        </span>
      </div>
    </div>
  )
}
