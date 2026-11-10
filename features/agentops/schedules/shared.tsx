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
  TrendingDownIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react"

import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { deployedAgents } from "@/lib/data"
import type {
  RunStatus,
  TriggerAction,
  TriggerSource,
  TriggerStatus,
} from "@/lib/data/schedules"

/* ------------------------------------------------------------------------ */
/* Agent colours — fixed order, one hue per agent                            */
/* ------------------------------------------------------------------------ */

const agentIndex = new Map(deployedAgents.map((a, i) => [a.id, i]))

/** CSS colour for an agent: `var(--chart-1)` … `var(--chart-8)`, never cycled. */
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

export { fmtClock, fmtRunDuration, fmtUntil } from "./format"

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
  if (!traceId) return <span className="text-xs text-muted-foreground">—</span>
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
        "rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px]",
        className
      )}
    >
      {children}
    </code>
  )
}
