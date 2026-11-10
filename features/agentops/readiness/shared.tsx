"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckCircle2Icon, ShieldAlertIcon } from "lucide-react"

import { StateBadge, type BadgeSize } from "@/components/shared/status-badge"
import { defaultControlSet } from "@/lib/readiness/controls"
import {
  applicabilityLabel,
  effortLabel,
  maturityLevelLabel,
  statusLabel,
} from "@/lib/readiness/labels"
import { evaluateAssessment } from "@/lib/readiness/scoring"
import { readinessStore } from "@/lib/readiness/store"
import type {
  Applicability,
  AssessmentResult,
  ControlSet,
  ControlStatus,
  DomainDef,
  Effort,
  MaturityLevel,
} from "@/lib/readiness/types"

/**
 * Single hook every readiness component reads from. State lives in
 * `readinessStore` (localStorage); the result is derived on each change.
 */
export function useReadiness() {
  const state = readinessStore.use()
  const controlSet: ControlSet = state.customControlSet ?? defaultControlSet
  const result: AssessmentResult | null = React.useMemo(
    () =>
      state.assessment
        ? evaluateAssessment(state.assessment, controlSet)
        : null,
    [state.assessment, controlSet]
  )
  return { ...state, controlSet, result }
}

export type ReadinessTab =
  | "setup"
  | "controls"
  | "results"
  | "frameworks"
  | "tooling"
  | "library"
  | "share"

export const readinessTabs: ReadinessTab[] = [
  "setup",
  "controls",
  "results",
  "frameworks",
  "tooling",
  "library",
  "share",
]

/** Sync a query param without a navigation (see guardrails-view). */
export function setQueryParam(key: string, value: string | null) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (value) url.searchParams.set(key, value)
  else url.searchParams.delete(key)
  window.history.replaceState(null, "", url)
}

export function ControlStatusBadge({
  status,
  size = "default",
  className,
}: {
  status: ControlStatus
  size?: BadgeSize
  className?: string
}) {
  return (
    <StateBadge
      state={statusLabel[status]}
      size={size}
      className={className}
      icon={status === "verified" ? <CheckCircle2Icon /> : undefined}
    />
  )
}

export function ApplicabilityBadge({
  applicability,
  size = "sm",
}: {
  applicability: Applicability
  size?: BadgeSize
}) {
  if (applicability === "applies") return null
  return (
    <StateBadge
      state={applicabilityLabel[applicability]}
      size={size}
      dot={false}
    />
  )
}

export function GateBadge({ size = "sm" }: { size?: BadgeSize }) {
  return <StateBadge state="Gate" size={size} icon={<ShieldAlertIcon />} />
}

export function RequiredBadge({ size = "sm" }: { size?: BadgeSize }) {
  return <StateBadge state="Required" size={size} dot={false} />
}

export function EffortBadge({
  effort,
  size = "sm",
}: {
  effort: Effort
  size?: BadgeSize
}) {
  return (
    <StateBadge
      state={effortLabel[effort]}
      tone="neutral"
      size={size}
      dot={false}
    />
  )
}

export function MaturityBadge({
  level,
  size = "default",
}: {
  level: MaturityLevel
  size?: BadgeSize
}) {
  return <StateBadge state={maturityLevelLabel[level]} size={size} />
}

/** Small colored square + domain name; the color is the domain's chart token. */
export function DomainChip({
  domain,
  short = false,
  className,
}: {
  domain: DomainDef
  short?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        className
      )}
    >
      <span
        aria-hidden
        className="inline-block size-2 rounded-xs"
        style={{ backgroundColor: domain.color }}
      />
      {short ? domain.short : domain.title}
    </span>
  )
}

/** Risk 1–5 as filled dots. */
export function RiskDots({
  risk,
  className,
}: {
  risk: number
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      title={`Risk ${risk} of 5`}
      aria-label={`Risk ${risk} of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            i < risk
              ? risk >= 4
                ? "bg-destructive"
                : risk === 3
                  ? "bg-warning"
                  : "bg-foreground/60"
              : "bg-muted-foreground/25"
          )}
        />
      ))}
    </span>
  )
}

/** Tone for a 0–100 coverage score; shared by meters, heatmap cells and tiles. */
export function scoreTone(
  score: number
): "success" | "brand" | "warning" | "danger" {
  if (score >= 85) return "success"
  if (score >= 65) return "brand"
  if (score >= 40) return "warning"
  return "danger"
}

export const scoreTextClass = {
  success: "text-success-text",
  brand: "text-brand",
  warning: "text-warning-text",
  danger: "text-danger-text",
} as const

export const scoreSoftClass = {
  success: "bg-success/15 text-success-text",
  brand: "bg-brand/15 text-brand",
  warning: "bg-warning/20 text-warning-text",
  danger: "bg-destructive/15 text-danger-text",
} as const
