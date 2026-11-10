"use client"

import { cn } from "cn"
import {
  BotIcon,
  BracesIcon,
  CheckIcon,
  CodeIcon,
  GlobeIcon,
  PlugZapIcon,
  ShieldBanIcon,
  UserCheckIcon,
  type LucideIcon,
} from "lucide-react"

import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getDeployedAgent } from "@/lib/data"
import {
  getMcpServer,
  type McpAuth,
  type McpStatus,
  type McpTransport,
  type PermissionDecision,
  type ToolApproval,
  type ToolRisk,
  type ToolSource,
  type ToolStatus,
} from "@/lib/data/tools"

/* ------------------------------------------------------------------------ */
/* Tones — passed explicitly until the strings land in stateTone            */
/* ------------------------------------------------------------------------ */

export const riskTone: Record<ToolRisk, Tone> = {
  Read: "success",
  Write: "warning",
  Destructive: "danger",
}

export const toolStatusTone: Record<ToolStatus, Tone> = {
  Active: "success",
  Deprecated: "muted",
  Disabled: "danger",
}

export const serverStatusTone: Record<McpStatus, Tone> = {
  Connected: "success",
  Degraded: "warning",
  Disconnected: "danger",
}

export const approvalMeta: Record<
  ToolApproval,
  { tone: Tone; icon: LucideIcon; hint: string }
> = {
  Auto: {
    tone: "success",
    icon: CheckIcon,
    hint: "Calls execute immediately within the agent's rate limit.",
  },
  "Require approval": {
    tone: "warning",
    icon: UserCheckIcon,
    hint: "Each call parks in the review queue until a human approves it.",
  },
  Blocked: {
    tone: "danger",
    icon: ShieldBanIcon,
    hint: "The tool is visible to the model but every call is rejected.",
  },
}

export const decisionMeta: Record<
  PermissionDecision,
  { label: string; tone: Tone; icon: LucideIcon; description: string }
> = {
  allow: {
    label: "Allow",
    tone: "success",
    icon: CheckIcon,
    description: "Calls run automatically",
  },
  approval: {
    label: "Approval",
    tone: "warning",
    icon: UserCheckIcon,
    description: "A reviewer approves each call",
  },
  deny: {
    label: "Deny",
    tone: "danger",
    icon: ShieldBanIcon,
    description: "Calls are rejected",
  },
}

export function RiskBadge({
  risk,
  size,
  className,
}: {
  risk: ToolRisk
  size?: "sm" | "default"
  className?: string
}) {
  return (
    <StateBadge
      state={risk}
      tone={riskTone[risk]}
      size={size}
      className={className}
    />
  )
}

export function ApprovalBadge({
  approval,
  size = "default",
  className,
}: {
  approval: ToolApproval
  size?: "sm" | "default"
  className?: string
}) {
  const meta = approvalMeta[approval]
  const Icon = meta.icon
  return (
    <StateBadge
      state={approval}
      tone={meta.tone}
      size={size}
      icon={<Icon aria-hidden />}
      className={className}
    />
  )
}

export function ToolStatusBadge({
  status,
  size,
}: {
  status: ToolStatus
  size?: "sm" | "default"
}) {
  return <StateBadge state={status} tone={toolStatusTone[status]} size={size} />
}

export function ServerStatusBadge({
  status,
  size,
  pulse,
}: {
  status: McpStatus
  size?: "sm" | "default"
  pulse?: boolean
}) {
  return (
    <StateBadge
      state={status}
      tone={serverStatusTone[status]}
      size={size}
      pulse={pulse ?? status === "Degraded"}
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Source                                                                    */
/* ------------------------------------------------------------------------ */

export const sourceKindMeta: Record<
  ToolSource["kind"],
  { label: string; icon: LucideIcon; className: string }
> = {
  mcp: {
    label: "MCP server",
    icon: PlugZapIcon,
    className: "border-brand/30 bg-brand/10 text-brand",
  },
  builtin: {
    label: "Built-in",
    icon: BracesIcon,
    className: "border-chart-3/30 bg-chart-3/15 text-chart-3",
  },
  http: {
    label: "HTTP API",
    icon: GlobeIcon,
    className: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  },
  code: {
    label: "Code",
    icon: CodeIcon,
    className: "border-chart-2/30 bg-chart-2/15 text-chart-2",
  },
}

export function sourceLabel(source: ToolSource) {
  if (source.kind === "mcp")
    return getMcpServer(source.serverId ?? "")?.name ?? source.serverId ?? "mcp"
  return source.label ?? sourceKindMeta[source.kind].label
}

/** Compact chip: kind icon in a tinted tile plus the server / API name. */
export function SourceChip({
  source,
  className,
  onServerClick,
}: {
  source: ToolSource
  className?: string
  /** Makes MCP server names clickable (opens the server sheet). */
  onServerClick?: (serverId: string) => void
}) {
  const meta = sourceKindMeta[source.kind]
  const Icon = meta.icon
  const label = sourceLabel(source)
  const body = (
    <>
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
          meta.className
        )}
      >
        <Icon className="size-3" aria-hidden />
      </span>
      <span className="truncate font-mono text-xs">{label}</span>
    </>
  )
  const title = `${meta.label}${source.kind === "mcp" ? ` · ${label}` : ""}`
  if (source.kind === "mcp" && source.serverId && onServerClick) {
    const id = source.serverId
    return (
      <button
        type="button"
        title={title}
        onClick={(e) => {
          e.stopPropagation()
          onServerClick(id)
        }}
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          className
        )}
      >
        {body}
      </button>
    )
  }
  return (
    <span
      title={title}
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
    >
      {body}
    </span>
  )
}

export const transportLabel: Record<McpTransport, string> = {
  stdio: "stdio",
  "streamable-http": "Streamable HTTP",
  sse: "SSE (legacy)",
}

export function TransportBadge({ transport }: { transport: McpTransport }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 font-mono text-[11px] font-medium",
        transport === "sse"
          ? "border-warning/40 bg-warning/10 text-warning-text"
          : "text-muted-foreground"
      )}
    >
      {transportLabel[transport]}
    </Badge>
  )
}

export const authTone: Record<McpAuth, string> = {
  "OAuth 2.1": "border-brand/30 bg-brand/10 text-brand",
  mTLS: "border-success/30 bg-success/10 text-success-text",
  "API key": "border-chart-4/30 bg-chart-4/15 text-chart-4",
  none: "border-warning/40 bg-warning/10 text-warning-text",
}

export function AuthBadge({ auth }: { auth: McpAuth }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 px-1.5 text-[11px] font-medium", authTone[auth])}
    >
      {auth === "none" ? "No auth" : auth}
    </Badge>
  )
}

/* ------------------------------------------------------------------------ */
/* Agents                                                                    */
/* ------------------------------------------------------------------------ */

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

/** Stacked agent avatars with a hover list; `+N` once it overflows `max`. */
export function AgentStack({
  agentIds,
  max = 3,
  className,
}: {
  agentIds: string[]
  max?: number
  className?: string
}) {
  const agents = agentIds
    .map((id) => getDeployedAgent(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
  if (agents.length === 0)
    return (
      <span className={cn("text-xs text-muted-foreground/70", className)}>
        No agents
      </span>
    )
  const shown = agents.slice(0, max)
  const rest = agents.length - shown.length
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex items-center -space-x-1.5 rounded-full",
              className
            )}
            aria-label={`${agents.length} agent${agents.length === 1 ? "" : "s"}: ${agents.map((a) => a.name).join(", ")}`}
          />
        }
      >
        {shown.map((a) => (
          <span
            key={a.id}
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-full border border-brand/30 bg-brand/10 font-mono text-[9px] font-semibold text-brand ring-2 ring-background"
          >
            {agentInitials(a.name)}
          </span>
        ))}
        {rest > 0 && (
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-full border bg-muted font-mono text-[9px] font-medium text-muted-foreground tabular-nums ring-2 ring-background"
          >
            +{rest}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-0.5">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-1.5 text-xs">
              <BotIcon className="size-3" aria-hidden /> {a.name}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

export function fmtPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`
}
