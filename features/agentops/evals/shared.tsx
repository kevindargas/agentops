"use client"

import { cn } from "cn"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react"

import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getEvaluator,
  type EvalCaseChange,
  type EvalRunStatus,
} from "@/lib/data/evals"
import { formatEvalScore } from "./format"

export { fmtCost, fmtDuration, fmtMs, formatEvalScore } from "./format"

/* ------------------------------------------------------------------------ */
/* Tones for strings not yet in stateTone                                    */
/* ------------------------------------------------------------------------ */

/**
 * Eval-specific states. `Passed`, `Queued`, `Pass`, `Fail`, `Regression`,
 * `Improvement` and `Same` are not in `stateTone` yet, so we pass an explicit
 * tone; once added to status-badge.tsx these overrides become redundant.
 */
export const evalTone: Record<string, Tone> = {
  Passed: "success",
  Failed: "danger",
  Running: "progress",
  Queued: "muted",
  Cancelled: "muted",
  Pass: "success",
  Fail: "danger",
  Regression: "danger",
  Improvement: "success",
  Same: "muted",
}

export function RunStatusBadge({
  status,
  size,
}: {
  status: EvalRunStatus
  size?: "sm" | "default"
}) {
  return (
    <StateBadge
      state={status}
      tone={evalTone[status]}
      size={size}
      pulse={status === "Running"}
    />
  )
}

export function PassFailBadge({
  passed,
  size = "sm",
}: {
  passed: boolean
  size?: "sm" | "default"
}) {
  const s = passed ? "Pass" : "Fail"
  return <StateBadge state={s} tone={evalTone[s]} size={size} />
}

const changeLabel: Record<EvalCaseChange, string> = {
  regression: "Regression",
  improvement: "Improvement",
  same: "Same",
}

export function ChangeBadge({
  change,
  size = "sm",
}: {
  change: EvalCaseChange
  size?: "sm" | "default"
}) {
  const s = changeLabel[change]
  if (change === "same")
    return <span className="text-xs text-muted-foreground">Same</span>
  return (
    <StateBadge
      state={s}
      tone={evalTone[s]}
      size={size}
      icon={
        change === "regression" ? <ArrowDownRightIcon /> : <ArrowUpRightIcon />
      }
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Chips                                                                     */
/* ------------------------------------------------------------------------ */

export function PromptChip({
  version,
  className,
}: {
  version: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 font-mono text-[11px] font-medium text-muted-foreground",
        className
      )}
      title={`Prompt version ${version}`}
    >
      {version}
    </Badge>
  )
}

export function DatasetChip({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <code
      className={cn(
        "rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px] whitespace-nowrap",
        className
      )}
    >
      {name}
    </code>
  )
}

/* ------------------------------------------------------------------------ */
/* Scores                                                                    */
/* ------------------------------------------------------------------------ */

export function scoreToneFor(score: number): Tone {
  return score >= 0.85 ? "success" : score >= 0.7 ? "warning" : "danger"
}

const toneCell: Record<Tone, string> = {
  success: "bg-success/12 text-success-text",
  warning: "bg-warning/15 text-warning-text",
  danger: "bg-destructive/12 text-danger-text",
  neutral: "bg-muted text-foreground",
  info: "bg-info/10 text-info-text",
  progress: "bg-brand/10 text-brand",
  muted: "bg-muted text-muted-foreground",
}

/** Compact tinted score cell (the comparison-grid unit). */
export function ScoreCell({
  evaluatorId,
  value,
  className,
  showName = false,
}: {
  evaluatorId: string
  value: number | undefined
  className?: string
  showName?: boolean
}) {
  const ev = getEvaluator(evaluatorId)
  if (value === undefined || !ev)
    return (
      <span
        className={cn(
          "inline-flex h-6 min-w-10 items-center justify-center rounded-md bg-muted px-1.5 font-mono text-[11px] text-muted-foreground/60",
          className
        )}
      >
        —
      </span>
    )
  const tone = scoreToneFor(value)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex h-6 min-w-10 items-center justify-center gap-1 rounded-md px-1.5 font-mono text-[11px] font-medium tabular-nums",
              toneCell[tone],
              className
            )}
          />
        }
      >
        {showName && (
          <span className="font-sans font-normal opacity-80">
            {shortName(ev.name)}
          </span>
        )}
        {formatEvalScore(value, ev.scale)}
      </TooltipTrigger>
      <TooltipContent>
        {ev.name} · {formatEvalScore(value, ev.scale)}
      </TooltipContent>
    </Tooltip>
  )
}

export function shortName(name: string) {
  return name
    .replace(/ judge$/i, "")
    .replace(/ rubric$/i, "")
    .replace(/ scanner$/i, "")
    .replace(/^Answer /i, "")
    .replace(/ budget$/i, "")
}

/** Signed delta in points, coloured by direction. */
export function DeltaValue({
  value,
  unit = "pt",
  digits = 0,
  className,
  upIsGood = true,
}: {
  value: number | null | undefined
  unit?: string
  digits?: number
  className?: string
  upIsGood?: boolean
}) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground/60">—</span>
  if (value === 0)
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums",
          className
        )}
      >
        <MinusIcon className="size-3" /> 0{unit}
      </span>
    )
  const good = value > 0 ? upIsGood : !upIsGood
  const Icon = value > 0 ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        good ? "text-success-text" : "text-danger-text",
        className
      )}
    >
      <Icon className="size-3" strokeWidth={2.25} />
      {value > 0 ? "+" : "−"}
      {Math.abs(value).toFixed(digits)}
      {unit}
    </span>
  )
}

/** Fraction bar: n passed / n failed. */
export function CasesBar({
  passed,
  failed,
  className,
}: {
  passed: number
  failed: number
  className?: string
}) {
  const total = passed + failed
  if (!total) return <span className="text-muted-foreground/60">—</span>
  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <span className="font-mono text-xs tabular-nums">
        <span className="text-success-text">{passed}</span>
        <span className="text-muted-foreground"> / </span>
        <span className={failed ? "text-danger-text" : "text-muted-foreground"}>
          {failed}
        </span>
      </span>
      <span className="flex h-1 w-20 overflow-hidden rounded-full bg-muted">
        <span
          className="h-full bg-success"
          style={{ width: `${(passed / total) * 100}%` }}
        />
        <span
          className="h-full bg-destructive"
          style={{ width: `${(failed / total) * 100}%` }}
        />
      </span>
    </span>
  )
}
