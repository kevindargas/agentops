"use client"

import { cn } from "cn"
import {
  ActivityIcon,
  BookOpenIcon,
  BotIcon,
  ClockIcon,
  CoinsIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  MegaphoneIcon,
  RadarIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SirenIcon,
  TimerIcon,
  ScrollTextIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StateBadge } from "@/components/shared/status-badge"
import { autonomyMeta, type AiAgent, type Autonomy } from "@/lib/ai/agents"
import { timeAgo } from "@/lib/format"

/* ------------------------------------------------------------------ */
/* Shared visual identity for agents                                   */
/* ------------------------------------------------------------------ */

const agentIcon: Record<string, LucideIcon> = {
  triage: SirenIcon,
  correlate: RadarIcon,
  risk: ShieldAlertIcon,
  kb: BookOpenIcon,
  comms: MegaphoneIcon,
  "prompt-hygiene": ScrollTextIcon,
  "cost-guardian": CoinsIcon,
  "eval-sentinel": FlaskConicalIcon,
  "tool-auditor": KeyRoundIcon,
}

/** Square brand-tinted avatar used wherever an agent is named. */
export function AgentAvatar({
  agentId,
  size = "md",
  muted = false,
  className,
}: {
  agentId?: string
  size?: "xs" | "sm" | "md" | "lg"
  muted?: boolean
  className?: string
}) {
  const Icon = (agentId && agentIcon[agentId]) || BotIcon
  const dims =
    size === "xs"
      ? "size-5 rounded-sm [&_svg]:size-3"
      : size === "sm"
        ? "size-7 rounded-md [&_svg]:size-3.5"
        : size === "md"
          ? "size-8 rounded-md [&_svg]:size-4"
          : "size-10 rounded-lg [&_svg]:size-5"
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        muted
          ? "bg-muted text-muted-foreground"
          : "bg-linear-to-br from-brand/20 to-brand/5 text-brand ring-1 ring-brand/15 ring-inset",
        dims,
        className
      )}
    >
      <Icon />
    </span>
  )
}

export const autonomyIcon: Record<Autonomy, LucideIcon> = {
  suggest: ActivityIcon,
  approve: ShieldCheckIcon,
  autonomous: ZapIcon,
}

const autonomyOrder = Object.keys(autonomyMeta) as Autonomy[]
const autonomyItems = autonomyOrder.map((a) => ({
  value: a,
  label: autonomyMeta[a].label,
}))

function AutonomySelect({
  value,
  disabled,
  onChange,
  className,
}: {
  value: Autonomy
  disabled?: boolean
  onChange: (a: Autonomy) => void
  className?: string
}) {
  const Icon = autonomyIcon[value]
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v as Autonomy)}
      disabled={disabled}
      items={autonomyItems}
    >
      <SelectTrigger
        size="sm"
        className={cn("h-7 gap-1.5 text-xs", className)}
        aria-label="Autonomy level"
      >
        <Icon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {autonomyOrder.map((a) => {
          const I = autonomyIcon[a]
          return (
            <SelectItem key={a} value={a}>
              <I className="size-3.5" /> {autonomyMeta[a].label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base leading-tight font-semibold tabular-nums">
        {value}
      </p>
      {hint && (
        <p className="truncate text-[11px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function AgentCard({
  agent,
  onChange,
  compact = false,
}: {
  agent: AiAgent
  onChange: (patch: Partial<Pick<AiAgent, "enabled" | "autonomy">>) => void
  compact?: boolean
}) {
  const savedHours = (agent.actions24h * agent.avgSavedMinutes) / 60

  if (compact) {
    return (
      <div
        className={cn(
          "group/agent flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors",
          !agent.enabled && "bg-muted/20"
        )}
      >
        <AgentAvatar agentId={agent.id} muted={!agent.enabled} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "truncate text-sm font-medium",
                !agent.enabled && "text-muted-foreground"
              )}
            >
              {agent.name}
            </p>
            <StateBadge
              state={agent.health}
              className="ml-auto h-[18px] px-1.5 text-[10px]"
            />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {agent.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <AutonomySelect
              value={agent.autonomy}
              disabled={!agent.enabled}
              onChange={(a) => onChange({ autonomy: a })}
              className="w-40"
            />
            <span className="hidden text-[11px] text-muted-foreground tabular-nums @[360px]:inline">
              {agent.actions24h} actions · {agent.acceptanceRate}%
            </span>
            <Switch
              size="sm"
              checked={agent.enabled}
              onCheckedChange={(v) => onChange({ enabled: v })}
              className="ml-auto"
              aria-label={`Enable ${agent.name}`}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card
      className={cn("gap-4 transition-colors", !agent.enabled && "bg-muted/20")}
    >
      <CardHeader className="gap-0">
        <div className="flex items-start gap-3">
          <AgentAvatar agentId={agent.id} size="lg" muted={!agent.enabled} />
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
              <span className={cn(!agent.enabled && "text-muted-foreground")}>
                {agent.name}
              </span>
              <Badge
                variant="secondary"
                className="h-[18px] px-1.5 text-[10px]"
              >
                {agent.module}
              </Badge>
              <StateBadge
                state={agent.health}
                className="h-[18px] px-1.5 text-[10px]"
              />
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2 leading-relaxed">
              {agent.description}
            </CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Switch
                checked={agent.enabled}
                onCheckedChange={(v) => onChange({ enabled: v })}
                aria-label={`Enable ${agent.name}`}
              />
            </TooltipTrigger>
            <TooltipContent>
              {agent.enabled ? "Pause agent" : "Resume agent"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Runs · 24h" value={agent.runs24h.toLocaleString()} />
          <Metric
            label="Actions"
            value={agent.actions24h}
            hint={
              agent.runs24h
                ? `${Math.round((agent.actions24h / agent.runs24h) * 100)}% of runs`
                : "—"
            }
          />
          <Metric
            label="Time saved"
            value={
              savedHours >= 1
                ? `${savedHours.toFixed(savedHours >= 10 ? 0 : 1)}h`
                : `${Math.round(savedHours * 60)}m`
            }
            hint={`${agent.avgSavedMinutes} min / action`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Acceptance rate</span>
            <span className="font-medium tabular-nums">
              {agent.acceptanceRate}%
            </span>
          </div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={agent.acceptanceRate}
            aria-label="Acceptance rate"
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                agent.acceptanceRate >= 90
                  ? "bg-success"
                  : agent.acceptanceRate >= 80
                    ? "bg-brand"
                    : "bg-warning"
              )}
              style={{ width: `${agent.acceptanceRate}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Autonomy</p>
          <div
            role="radiogroup"
            aria-label="Autonomy level"
            className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1"
          >
            {autonomyOrder.map((a) => {
              const Icon = autonomyIcon[a]
              const active = agent.autonomy === a
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!agent.enabled}
                  onClick={() => onChange({ autonomy: a })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
                    active
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="truncate">{autonomyMeta[a].label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {autonomyMeta[agent.autonomy].description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {agent.tools.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="h-5 rounded-md px-1.5 font-mono text-[10px] text-muted-foreground"
            >
              {t}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3 py-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <ClockIcon className="size-3 shrink-0" />
          <span className="truncate">{agent.trigger}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <TimerIcon className="size-3" /> Last run {timeAgo(agent.lastRun)}
        </span>
      </CardFooter>
    </Card>
  )
}
