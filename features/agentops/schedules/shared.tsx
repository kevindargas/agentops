"use client"

import Link from "next/link"
import { cn } from "cn"
import {
  BellIcon,
  BotIcon,
  CoinsIcon,
  FlaskConicalIcon,
  GitBranchIcon,
  InboxIcon,
  LayersIcon,
  MailIcon,
  MessageCircleIcon,
  PauseCircleIcon,
  TrendingDownIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyValue } from "@/components/data-table"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import type {
  RunStatus,
  TriggerAction,
  TriggerSource,
  TriggerStatus,
} from "@/lib/data/schedules"

/* ------------------------------------------------------------------------ */
/* Agent colours: fixed order, one hue per agent                             */
/* ------------------------------------------------------------------------ */

const agentIndex = new Map(deployedAgents.map((a, i) => [a.id, i]))

/** CSS colour for an agent: `var(--chart-1)` to `var(--chart-8)`, never cycled. */
export function agentColor(agentId: string) {
  const i = agentIndex.get(agentId) ?? 0
  return `var(--chart-${Math.min(8, i + 1)})`
}

export function AgentDot({
  agentId,
  className,
}: {
  agentId: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: agentColor(agentId) }}
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Badges                                                                    */
/* ------------------------------------------------------------------------ */

const triggerStatusTone: Record<TriggerStatus, Tone> = {
  Active: "success",
  Paused: "warning",
  Error: "danger",
}

export function TriggerStatusBadge({
  status,
  size,
}: {
  status: TriggerStatus
  size?: "sm" | "default"
}) {
  return (
    <StateBadge state={status} tone={triggerStatusTone[status]} size={size} />
  )
}

export function RunStatusBadge({
  status,
  size,
}: {
  status: RunStatus
  size?: "sm" | "default"
}) {
  return <StateBadge state={status} size={size} pulse={status === "Running"} />
}

/**
 * Warning chip shown next to a schedule or trigger whose target agent is
 * manually paused: the scheduler will not get a run accepted until the agent
 * is resumed.
 */
export function TargetPausedBadge({
  agentId,
  className,
}: {
  agentId: string
  className?: string
}) {
  const agent = getDeployedAgent(agentId)
  if (!agent?.paused) return null
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-1 border-warning/40 px-1.5 text-2xs text-warning-text",
        className
      )}
      title={agent.pausedReason ?? `${agent.name} is paused`}
    >
      <PauseCircleIcon className="size-3" />
      Target agent paused
    </Badge>
  )
}

export const sourceIcon: Record<TriggerSource, LucideIcon> = {
  Webhook: WebhookIcon,
  "Slack mention": MessageCircleIcon,
  "Email inbox": MailIcon,
  Queue: LayersIcon,
  "Record event": InboxIcon,
  "Drift signal": TrendingDownIcon,
  "Budget threshold": CoinsIcon,
  "Eval failure": FlaskConicalIcon,
  "Git push": GitBranchIcon,
}

export const actionIcon: Record<TriggerAction, LucideIcon> = {
  "Run agent": BotIcon,
  "Open review": InboxIcon,
  Notify: BellIcon,
}

export function TraceLink({ traceId }: { traceId?: string }) {
  if (!traceId) return <EmptyValue />
  return (
    <Link
      href={`/agentops/traces/${traceId}`}
      className="font-mono text-xs hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {traceId}
    </Link>
  )
}

export function Mono({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <code
      className={cn(
        "rounded-sm bg-muted px-1 py-0.5 font-mono text-2xs",
        className
      )}
    >
      {children}
    </code>
  )
}
