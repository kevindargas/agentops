"use client"

import Link from "next/link"
import { cn } from "cn"
import {
  BotIcon,
  BracesIcon,
  DatabaseIcon,
  GitForkIcon,
  ShieldCheckIcon,
  SplitIcon,
  UserRoundIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { providerLabel, providerLogo } from "@/lib/ai/openrouter"
import { modelDisplayName } from "./format"
import { getDeployedAgent } from "@/lib/data"
import type { AgentFramework, GraphNodeType } from "@/lib/types"

export { fmtCost, fmtMs, fmtTokens, modelDisplayName } from "./format"

/* ------------------------------------------------------------------------ */
/* Chips                                                                     */
/* ------------------------------------------------------------------------ */

export function ModelChip({
  modelId,
  className,
  showProvider = false,
}: {
  modelId: string
  className?: string
  showProvider?: boolean
}) {
  const provider = modelId.split("/")[0]
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 text-sm",
              className
            )}
          />
        }
      >
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border bg-background">
          <ModelSelectorLogo
            provider={providerLogo(provider)}
            className="size-3"
          />
        </span>
        <span className="truncate">
          {modelDisplayName(modelId)}
          {showProvider && (
            <span className="text-muted-foreground">
              {" "}
              · {providerLabel(provider)}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs">{modelId}</span>
      </TooltipContent>
    </Tooltip>
  )
}

const frameworkTone: Record<AgentFramework, string> = {
  LangGraph: "border-brand/30 bg-brand/10 text-brand",
  LangChain: "border-success/30 bg-success/10 text-success-text",
  Custom: "border-border bg-muted text-muted-foreground",
}

export function FrameworkBadge({
  framework,
  className,
}: {
  framework: AgentFramework
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[11px] font-medium",
        frameworkTone[framework],
        className
      )}
    >
      {framework}
    </Badge>
  )
}

export function AgentChip({
  agentId,
  className,
  size = "default",
}: {
  agentId: string
  className?: string
  size?: "default" | "sm"
}) {
  const agent = getDeployedAgent(agentId)
  if (!agent)
    return <span className="text-muted-foreground">Unknown agent</span>
  return (
    <Link
      href={`/agentops/agents/${agent.id}`}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 hover:underline",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand",
          size === "sm" ? "size-4" : "size-5"
        )}
      >
        <BotIcon className={size === "sm" ? "size-2.5" : "size-3"} />
      </span>
      <span className="truncate font-medium">{agent.name}</span>
    </Link>
  )
}

/* ------------------------------------------------------------------------ */
/* Scores                                                                    */
/* ------------------------------------------------------------------------ */

export function scoreTone(score: number, thresholds = { good: 90, ok: 80 }) {
  return score >= thresholds.good
    ? "success"
    : score >= thresholds.ok
      ? "warning"
      : "danger"
}

const toneBar: Record<"success" | "warning" | "danger", string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}
const toneText: Record<"success" | "warning" | "danger", string> = {
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
}

/** Compact 0–100 score with a tinted bar underneath. */
export function ScoreBar({
  value,
  max = 100,
  thresholds,
  className,
  label,
}: {
  value: number
  max?: number
  thresholds?: { good: number; ok: number }
  className?: string
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const tone = scoreTone(pct, thresholds)
  return (
    <span
      className={cn("inline-flex min-w-16 flex-col gap-1", className)}
      aria-label={label ?? `${value} of ${max}`}
    >
      <span className={cn("text-sm font-medium tabular-nums", toneText[tone])}>
        {max === 1 ? value.toFixed(2) : Math.round(value)}
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", toneBar[tone])}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Graph node styling                                                        */
/* ------------------------------------------------------------------------ */

export const nodeMeta: Record<
  GraphNodeType,
  { label: string; icon: LucideIcon; className: string }
> = {
  router: {
    label: "Router",
    icon: SplitIcon,
    className: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  },
  llm: {
    label: "LLM",
    icon: BotIcon,
    className: "bg-brand/10 text-brand border-brand/30",
  },
  retriever: {
    label: "Retriever",
    icon: DatabaseIcon,
    className: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  },
  tool: {
    label: "Tool",
    icon: WrenchIcon,
    className: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  human: {
    label: "Human",
    icon: UserRoundIcon,
    className: "bg-warning/15 text-warning-text border-warning/40",
  },
  guard: {
    label: "Guard",
    icon: ShieldCheckIcon,
    className: "bg-success/10 text-success-text border-success/30",
  },
  chain: {
    label: "Chain",
    icon: GitForkIcon,
    className: "bg-muted text-muted-foreground border-border",
  },
}

export function NodeTypeIcon({
  type,
  className,
}: {
  type: GraphNodeType
  className?: string
}) {
  const Icon = nodeMeta[type]?.icon ?? BracesIcon
  return <Icon className={className} />
}
