"use client"

import { cn } from "cn"
import {
  BotIcon,
  BracesIcon,
  DatabaseIcon,
  GavelIcon,
  MessageSquareTextIcon,
  RegexIcon,
  ScaleIcon,
  TextCursorInputIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import type {
  Guardrail,
  GuardrailCategory,
  GuardrailEngine,
  GuardrailMode,
  GuardrailStatus,
  ViolationAction,
} from "@/lib/data/guardrails"
import { ModelChip } from "../shared"

/* ------------------------------------------------------------------------ */
/* Tones — new state strings; see stateTone in components/shared/status-badge */
/* ------------------------------------------------------------------------ */

export const modeTone: Record<GuardrailMode, Tone> = {
  Block: "danger",
  Flag: "warning",
  Redact: "info",
  "Require approval": "progress",
}

export const actionTone: Record<ViolationAction, Tone> = {
  Blocked: "danger",
  Flagged: "warning",
  Redacted: "info",
  "Approval requested": "progress",
}

export const statusTone: Record<GuardrailStatus, Tone> = {
  Active: "success",
  Disabled: "muted",
  Draft: "muted",
}

export function ModeBadge({
  mode,
  size,
}: {
  mode: GuardrailMode
  size?: "sm" | "default"
}) {
  return <StateBadge state={mode} tone={modeTone[mode]} size={size} />
}

export function ActionBadge({
  action,
  size,
}: {
  action: ViolationAction
  size?: "sm" | "default"
}) {
  return <StateBadge state={action} tone={actionTone[action]} size={size} />
}

export function PolicyStatusBadge({
  status,
  size,
}: {
  status: GuardrailStatus
  size?: "sm" | "default"
}) {
  return <StateBadge state={status} tone={statusTone[status]} size={size} />
}

/* ------------------------------------------------------------------------ */
/* Category                                                                  */
/* ------------------------------------------------------------------------ */

export const categoryMeta: Record<
  GuardrailCategory,
  { icon: LucideIcon; className: string; hint: string }
> = {
  Input: {
    icon: TextCursorInputIcon,
    className: "border-chart-1/30 bg-chart-1/10 text-chart-1",
    hint: "What the agent may read",
  },
  Output: {
    icon: MessageSquareTextIcon,
    className: "border-chart-2/30 bg-chart-2/10 text-chart-2",
    hint: "What the agent may say",
  },
  Action: {
    icon: ZapIcon,
    className: "border-chart-4/30 bg-chart-4/10 text-chart-4",
    hint: "What the agent may do",
  },
  Data: {
    icon: DatabaseIcon,
    className: "border-chart-3/30 bg-chart-3/10 text-chart-3",
    hint: "Where data may live and for how long",
  },
}

export function CategoryBadge({
  category,
  className,
}: {
  category: GuardrailCategory
  className?: string
}) {
  const meta = categoryMeta[category]
  const Icon = meta.icon
  return (
    <Badge
      variant="outline"
      className={cn("h-5 gap-1 px-1.5 font-medium", meta.className, className)}
    >
      <Icon />
      {category}
    </Badge>
  )
}

/* ------------------------------------------------------------------------ */
/* Engine                                                                    */
/* ------------------------------------------------------------------------ */

export const engineLabel: Record<GuardrailEngine, string> = {
  regex: "Regex",
  classifier: "Classifier",
  "llm-judge": "LLM judge",
  schema: "Schema",
  "policy-engine": "Policy engine",
}

const engineIcon: Record<GuardrailEngine, LucideIcon> = {
  regex: RegexIcon,
  classifier: ScaleIcon,
  "llm-judge": GavelIcon,
  schema: BracesIcon,
  "policy-engine": ZapIcon,
}

export function EngineCell({
  policy,
  className,
}: {
  policy: Pick<Guardrail, "engine" | "modelId">
  className?: string
}) {
  const Icon = engineIcon[policy.engine]
  if (policy.modelId)
    return (
      <span className={cn("flex min-w-0 flex-col gap-0.5", className)}>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Icon className="size-3" /> {engineLabel[policy.engine]}
        </span>
        <ModelChip modelId={policy.modelId} className="text-xs" />
      </span>
    )
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
        className
      )}
    >
      <Icon className="size-3.5" /> {engineLabel[policy.engine]}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Scope                                                                     */
/* ------------------------------------------------------------------------ */

export function scopeLabel(scope: Guardrail["scope"]) {
  if (scope === "all") return "All agents"
  return `${scope.length} agent${scope.length === 1 ? "" : "s"}`
}

export function ScopeCell({
  scope,
  className,
}: {
  scope: Guardrail["scope"]
  className?: string
}) {
  const ids = scope === "all" ? deployedAgents.map((a) => a.id) : scope
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex cursor-default items-center gap-1 text-sm tabular-nums underline decoration-muted-foreground/50 decoration-dotted underline-offset-[3px]",
              scope === "all" && "text-muted-foreground",
              className
            )}
          />
        }
      >
        {scopeLabel(scope)}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <ul className="flex flex-col gap-0.5 py-0.5">
          {ids.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <BotIcon className="size-3 opacity-70" />
              {getDeployedAgent(id)?.name ?? id}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

export const fmtPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`
