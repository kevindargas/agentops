"use client"

import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react"

import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  EvalGate,
  Release,
  ReleaseChange,
  ReleaseEnvironment,
  ReleaseStage,
  ReleaseStrategy,
} from "@/lib/data/deployments"
import { formatDelta } from "@/lib/format"
import { ModelChip } from "../shared"

/* ------------------------------------------------------------------------ */
/* Tones for strings not yet in status-badge.tsx                             */
/* ------------------------------------------------------------------------ */

export const stageTone: Record<ReleaseStage, Tone> = {
  Draft: "muted",
  "Pending approval": "warning",
  Canary: "progress",
  Progressing: "progress",
  Promoted: "success",
  "Rolled back": "warning",
  Failed: "danger",
}

export const environmentTone: Record<ReleaseEnvironment, Tone> = {
  production: "success",
  staging: "info",
  development: "muted",
  shadow: "neutral",
}

export const environmentLabel: Record<ReleaseEnvironment, string> = {
  production: "Production",
  staging: "Staging",
  development: "Development",
  shadow: "Shadow",
}

export function StageBadge({
  stage,
  size,
  className,
}: {
  stage: ReleaseStage
  size?: "sm" | "default"
  className?: string
}) {
  return (
    <StateBadge
      state={stage}
      tone={stageTone[stage]}
      size={size}
      pulse={stage === "Canary" || stage === "Progressing"}
      className={className}
    />
  )
}

export function EnvironmentBadge({
  environment,
  size = "sm",
  className,
}: {
  environment: ReleaseEnvironment
  size?: "sm" | "default"
  className?: string
}) {
  return (
    <StateBadge
      state={environment}
      tone={environmentTone[environment]}
      size={size}
      dot={false}
      className={className}
    />
  )
}

export function VersionChip({
  version,
  className,
  tone = "default",
}: {
  version: string
  className?: string
  tone?: "default" | "muted"
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[11px] tabular-nums",
        tone === "muted" && "text-muted-foreground",
        className
      )}
    >
      {version}
    </Badge>
  )
}

/* ------------------------------------------------------------------------ */
/* Strategy / traffic                                                        */
/* ------------------------------------------------------------------------ */

export function strategyLabel(strategy: ReleaseStrategy, steps: number[]) {
  if (strategy === "Canary")
    return `Canary ${steps.map((s) => `${s}%`).join(" → ")}`
  if (strategy === "Shadow") return "Shadow (mirrored traffic)"
  return strategy
}

export function TrafficBar({
  value,
  steps,
  className,
  stage,
}: {
  value: number
  steps: number[]
  stage: ReleaseStage
  className?: string
}) {
  const inactive =
    stage === "Draft" || stage === "Pending approval" || stage === "Failed"
  return (
    <span
      className={cn("inline-flex min-w-24 items-center gap-2", className)}
      aria-label={`${value}% of traffic`}
    >
      <span className="relative flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "h-full rounded-full",
            stage === "Rolled back"
              ? "bg-warning"
              : stage === "Promoted"
                ? "bg-success"
                : "bg-brand"
          )}
          style={{ width: `${inactive ? 0 : value}%` }}
        />
        {steps
          .filter((s) => s > 0 && s < 100)
          .map((s) => (
            <span
              key={s}
              aria-hidden
              className="absolute top-0 h-full w-px bg-background"
              style={{ left: `${s}%` }}
            />
          ))}
      </span>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {inactive ? "—" : `${value}%`}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Change chips                                                              */
/* ------------------------------------------------------------------------ */

const kindChip: Record<ReleaseChange["kind"], string> = {
  prompt: "border-chart-1/30 bg-chart-1/10",
  model: "border-chart-4/30 bg-chart-4/10",
  tools: "border-chart-2/30 bg-chart-2/10",
  params: "border-border bg-muted",
  retrieval: "border-chart-3/30 bg-chart-3/10",
}

export function ChangeChip({
  change,
  className,
}: {
  change: ReleaseChange
  className?: string
}) {
  const base = cn(
    "inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-1.5 text-[11px] leading-none whitespace-nowrap",
    kindChip[change.kind],
    className
  )
  if (change.kind === "model")
    return (
      <span className={base}>
        <ModelChip
          modelId={change.before}
          className="text-[11px] [&>span:first-child]:size-4"
        />
        <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
        <ModelChip
          modelId={change.after}
          className="text-[11px] [&>span:first-child]:size-4"
        />
      </span>
    )
  if (change.kind === "tools") {
    const added = change.before === "—"
    return (
      <span className={cn(base, "font-mono")}>
        <span className={added ? "text-success-text" : "text-danger-text"}>
          {added ? "+" : "−"}
        </span>
        {added ? change.after : change.before}
      </span>
    )
  }
  return (
    <span className={base}>
      <span className="text-muted-foreground">
        {change.kind === "prompt" ? "prompt" : change.field}
      </span>
      <span className="font-mono tabular-nums">{change.before}</span>
      <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="font-mono tabular-nums">{change.after}</span>
    </span>
  )
}

export function ChangeChips({
  changes,
  max = 3,
  className,
}: {
  changes: ReleaseChange[]
  max?: number
  className?: string
}) {
  const shown = changes.slice(0, max)
  const rest = changes.length - shown.length
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((c, i) => (
        <ChangeChip key={`${c.kind}-${c.field}-${i}`} change={c} />
      ))}
      {rest > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex h-6 items-center rounded-md border px-1.5 text-[11px] text-muted-foreground" />
            }
          >
            +{rest} more
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col gap-1">
            {changes.slice(max).map((c, i) => (
              <span key={i} className="text-xs">
                {c.field}: {c.before} → {c.after}
              </span>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Health / gates                                                            */
/* ------------------------------------------------------------------------ */

export function HealthDeltas({
  release,
  className,
}: {
  release: Release
  className?: string
}) {
  const { errorRateDelta, qualityDelta } = release.health
  const measured =
    release.stage !== "Draft" &&
    release.stage !== "Pending approval" &&
    release.rollout.length > 0
  if (!measured)
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>—</span>
    )
  const errBad = errorRateDelta > 0.2
  const qBad = qualityDelta < -0.5
  return (
    <span
      className={cn(
        "inline-flex flex-col gap-0.5 text-xs leading-tight tabular-nums",
        className
      )}
    >
      <span className={errBad ? "text-danger-text" : "text-muted-foreground"}>
        err {formatDelta(errorRateDelta, "pt", 2)}
      </span>
      <span className={qBad ? "text-danger-text" : "text-muted-foreground"}>
        quality {formatDelta(qualityDelta, "", 1)}
      </span>
    </span>
  )
}

export function EvalGateChip({
  gate,
  className,
}: {
  gate?: EvalGate
  className?: string
}) {
  if (!gate)
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>—</span>
    )
  const meta =
    gate.status === "passed"
      ? {
          icon: <CheckCircle2Icon />,
          tone: "text-success-text",
          label: "Passed",
        }
      : gate.status === "failed"
        ? { icon: <XCircleIcon />, tone: "text-danger-text", label: "Failed" }
        : {
            icon: <ClockIcon />,
            tone: "text-muted-foreground",
            label: "Pending",
          }
  return (
    <Link
      href={`/agentops/evals?run=${gate.runId}`}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium hover:underline [&_svg]:size-3.5",
        meta.tone,
        className
      )}
      title={`Eval run ${gate.runId}`}
    >
      {meta.icon}
      {meta.label}
      {gate.status !== "pending" && (
        <span className="font-normal text-muted-foreground tabular-nums">
          {gate.score.toFixed(1)}
        </span>
      )}
    </Link>
  )
}
