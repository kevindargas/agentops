import { cn } from "cn"
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleIcon,
  InfoIcon,
  MinusIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { priorityLabels } from "@/lib/constants"
import { NOW } from "@/lib/data/seed"
import type { AlertSeverity, ChangeRisk, Priority } from "@/lib/types"

/**
 * Semantic tone for any lifecycle state. Keeps the state vocabulary of every
 * module (agent, trace, incident, change, request, review…) on one color system.
 */
export type Tone =
  "neutral" | "info" | "progress" | "warning" | "success" | "danger" | "muted"

export type BadgeSize = "sm" | "default"

/**
 * One treatment for every tone: tinted fill, hairline ring in the same hue and
 * a readable text color (`*-text` tokens in globals.css are tuned for 4.5:1 on
 * the tint in both modes). `dot` is the solid marker used inside badges and by
 * <StatusDot />; `text` is for inline text-only indicators.
 */
export const toneClasses: Record<
  Tone,
  { badge: string; dot: string; text: string; soft: string }
> = {
  neutral: {
    badge: "border-border bg-card text-foreground",
    dot: "bg-foreground/55",
    text: "text-foreground",
    soft: "bg-muted text-foreground",
  },
  info: {
    badge: "border-info/25 bg-info/10 text-info-text",
    dot: "bg-info",
    text: "text-info-text",
    soft: "bg-info/10 text-info-text",
  },
  progress: {
    badge: "border-brand/25 bg-brand/10 text-brand",
    dot: "bg-brand",
    text: "text-brand",
    soft: "bg-brand/10 text-brand",
  },
  warning: {
    badge: "border-warning/35 bg-warning/15 text-warning-text",
    dot: "bg-warning",
    text: "text-warning-text",
    soft: "bg-warning/15 text-warning-text",
  },
  success: {
    badge: "border-success/25 bg-success/10 text-success-text",
    dot: "bg-success",
    text: "text-success-text",
    soft: "bg-success/10 text-success-text",
  },
  danger: {
    badge: "border-destructive/25 bg-destructive/10 text-danger-text",
    dot: "bg-destructive",
    text: "text-danger-text",
    soft: "bg-destructive/10 text-danger-text",
  },
  muted: {
    badge: "border-transparent bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    soft: "bg-muted text-muted-foreground",
  },
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: "h-4.5 gap-1 px-1.5 text-[11px] leading-none [&>svg]:size-2.5!",
  default: "gap-1.5",
}

const stateTone: Record<string, Tone> = {
  // Prompt labels
  draft: "muted",
  archived: "muted",
  // Guardrails
  Block: "danger",
  Flag: "warning",
  Redact: "info",
  "Require approval": "progress",
  Redacted: "info",
  "Approval requested": "progress",
  Disabled: "muted",
  // Evals
  Passed: "success",
  Pass: "success",
  Fail: "danger",
  Queued: "muted",
  Regression: "danger",
  Improvement: "success",
  // Knowledge & memory
  Syncing: "progress",
  Synced: "success",
  Stale: "warning",
  Error: "danger",
  // Providers, keys, budgets
  Connected: "success",
  Disconnected: "danger",
  Expiring: "warning",
  Revoked: "muted",
  Rotating: "progress",
  Exceeded: "danger",
  Investigating: "danger",
  Monitoring: "warning",
  // Deployments
  "Pending approval": "warning",
  Canary: "progress",
  Progressing: "progress",
  "Rolled back": "warning",
  development: "muted",
  shadow: "neutral",
  // Tools & MCP
  Read: "success",
  Auto: "success",
  Write: "warning",
  Destructive: "danger",
  // Agent operations
  Drifting: "warning",
  "Needs review": "warning",
  Reviewed: "success",
  Flagged: "danger",
  Corrected: "info",
  Verified: "success",
  Deprecated: "muted",
  Promoted: "success",
  Stopped: "muted",
  Testing: "progress",
  Applied: "success",
  Dismissed: "muted",
  Acknowledged: "info",
  Warning: "warning",
  Info: "info",
  production: "success",
  staging: "info",
  // Readiness assessment
  "Not started": "muted",
  Planned: "info",
  Partial: "warning",
  "In place": "success",
  Applies: "neutral",
  "Down-weighted": "muted",
  "Not applicable": "muted",
  Required: "progress",
  Gate: "danger",
  Blocker: "danger",
  "Ad hoc": "danger",
  Defined: "warning",
  Managed: "info",
  Optimized: "success",
  "Open source": "success",
  "Open source + managed": "info",
  // generic
  New: "info",
  Open: "info",
  Draft: "muted",
  "In Progress": "progress",
  "Work in Progress": "progress",
  "Fix in Progress": "progress",
  Implement: "progress",
  Running: "progress",
  Fulfillment: "progress",
  Delivery: "progress",
  Assess: "warning",
  "Root Cause Analysis": "warning",
  Authorize: "warning",
  "Pending Approval": "warning",
  "Waiting for Approval": "warning",
  "On Hold": "warning",
  Review: "warning",
  Requested: "warning",
  Scheduled: "info",
  Approved: "success",
  Resolved: "success",
  Closed: "muted",
  "Closed Complete": "success",
  Completed: "success",
  Complete: "success",
  Published: "success",
  Operational: "success",
  Healthy: "success",
  Pending: "muted",
  "Closed Incomplete": "danger",
  "Closed Cancelled": "muted",
  Canceled: "muted",
  Cancelled: "muted",
  Rejected: "danger",
  Failed: "danger",
  Blocked: "danger",
  Missing: "danger",
  "Non-Operational": "danger",
  Critical: "danger",
  "Repair in Progress": "warning",
  Degraded: "warning",
  Retired: "muted",
  Pipeline: "info",
  Unknown: "muted",
  Reopen: "danger",
  Flapping: "warning",
  "Not Yet Requested": "muted",
  Active: "success",
  Inactive: "muted",
  // ai / automation
  Succeeded: "success",
  Executed: "success",
  Proposed: "info",
  Paused: "warning",
  Escalated: "danger",
  Skipped: "muted",
  // misc
  Online: "success",
  Offline: "muted",
  Maintenance: "warning",
  Outage: "danger",
  Overdue: "danger",
  "Due soon": "warning",
  "On track": "success",
  "At risk": "warning",
  Breached: "danger",
  Met: "success",
}

export function toneForState(state: string): Tone {
  return stateTone[state] ?? "neutral"
}

/** Solid status marker for tables and lists; pulses for in-flight tones. */
export function StatusDot({
  tone = "neutral",
  state,
  pulse,
  className,
}: {
  tone?: Tone
  state?: string
  pulse?: boolean
  className?: string
}) {
  const t = state ? toneForState(state) : tone
  const live = pulse ?? t === "progress"
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex size-2 shrink-0", className)}
    >
      {live && (
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:hidden",
            toneClasses[t].dot
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          toneClasses[t].dot
        )}
      />
    </span>
  )
}

export function StateBadge({
  state,
  tone,
  className,
  dot = true,
  size = "default",
  icon,
  pulse = false,
}: {
  state: string
  tone?: Tone
  className?: string
  dot?: boolean
  /** `sm` fits inside dense table rows and chips. */
  size?: BadgeSize
  /** Replaces the dot with a custom leading icon. */
  icon?: React.ReactNode
  /** Animate the dot for states that are actively changing. */
  pulse?: boolean
}) {
  const t = tone ?? toneForState(state)
  return (
    <Badge
      variant="outline"
      data-tone={t}
      className={cn(
        "font-medium whitespace-nowrap",
        sizeClasses[size],
        toneClasses[t].badge,
        className
      )}
    >
      {icon ? (
        icon
      ) : dot ? (
        <span aria-hidden className="relative inline-flex size-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:hidden",
                toneClasses[t].dot
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-full rounded-full",
              toneClasses[t].dot
            )}
          />
        </span>
      ) : null}
      {state}
    </Badge>
  )
}

const priorityTone: Record<Priority, Tone> = {
  1: "danger",
  2: "warning",
  3: "info",
  4: "neutral",
  5: "muted",
}

const priorityIcon: Record<Priority, React.ReactNode> = {
  1: <AlertOctagonIcon />,
  2: <ArrowUpIcon />,
  3: <MinusIcon />,
  4: <ArrowDownIcon />,
  5: <CircleIcon />,
}

export function PriorityBadge({
  priority,
  short = false,
  className,
  size = "default",
}: {
  priority: Priority
  short?: boolean
  className?: string
  size?: BadgeSize
}) {
  const t = priorityTone[priority]
  return (
    <Badge
      variant="outline"
      data-tone={t}
      title={`P${priority} · ${priorityLabels[priority]}`}
      className={cn(
        "font-medium tabular-nums",
        size === "sm" ? sizeClasses.sm : "gap-1",
        toneClasses[t].badge,
        className
      )}
    >
      {priorityIcon[priority]}
      {short ? `P${priority}` : `P${priority} · ${priorityLabels[priority]}`}
    </Badge>
  )
}

export function toneForPriority(priority: Priority): Tone {
  return priorityTone[priority]
}

const severityTone: Record<AlertSeverity, Tone> = {
  Critical: "danger",
  Major: "warning",
  Minor: "info",
  Warning: "neutral",
  Info: "muted",
  Clear: "success",
}

const severityIcon: Record<AlertSeverity, React.ReactNode> = {
  Critical: <AlertOctagonIcon />,
  Major: <AlertTriangleIcon />,
  Minor: <ArrowUpIcon />,
  Warning: <InfoIcon />,
  Info: <InfoIcon />,
  Clear: <CheckCircle2Icon />,
}

export function SeverityBadge({
  severity,
  className,
  size = "default",
}: {
  severity: AlertSeverity
  className?: string
  size?: BadgeSize
}) {
  const t = severityTone[severity]
  return (
    <Badge
      variant="outline"
      data-tone={t}
      className={cn(
        "font-medium",
        size === "sm" ? sizeClasses.sm : "gap-1",
        toneClasses[t].badge,
        className
      )}
    >
      {severityIcon[severity]}
      {severity}
    </Badge>
  )
}

export function toneForSeverity(severity: AlertSeverity): Tone {
  return severityTone[severity]
}

const riskTone: Record<ChangeRisk, Tone> = {
  Low: "success",
  Moderate: "info",
  High: "warning",
  "Very High": "danger",
}

export function RiskBadge({
  risk,
  className,
  size = "default",
}: {
  risk: ChangeRisk
  className?: string
  size?: BadgeSize
}) {
  return (
    <StateBadge
      state={risk}
      tone={riskTone[risk]}
      className={className}
      size={size}
    />
  )
}

export function SlaIndicator({
  due,
  breached,
  resolved,
  className,
}: {
  due: string
  breached: boolean
  resolved?: string
  className?: string
}) {
  if (resolved) {
    return breached ? (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          toneClasses.danger.text,
          className
        )}
      >
        <AlertTriangleIcon className="size-3.5" /> Breached
      </span>
    ) : (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          toneClasses.success.text,
          className
        )}
      >
        <CheckCircle2Icon className="size-3.5" /> Met
      </span>
    )
  }
  if (breached) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          toneClasses.danger.text,
          className
        )}
      >
        <AlertOctagonIcon className="size-3.5" /> Breached
      </span>
    )
  }
  const hours = (new Date(due).getTime() - NOW.getTime()) / 3_600_000
  const urgent = hours < 2
  const remaining =
    hours < 1
      ? `${Math.max(1, Math.round(hours * 60))}m left`
      : hours < 48
        ? `${Math.round(hours)}h left`
        : `${Math.round(hours / 24)}d left`
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs tabular-nums",
        urgent
          ? cn("font-medium", toneClasses.warning.text)
          : "text-muted-foreground",
        className
      )}
    >
      <StatusDot
        tone={urgent ? "warning" : "muted"}
        pulse={urgent}
        className="size-1.5 [&>span]:size-1.5"
      />
      {remaining}
    </span>
  )
}
