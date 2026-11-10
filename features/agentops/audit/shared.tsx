import { cn } from "cn"
import {
  BotIcon,
  CoinsIcon,
  CpuIcon,
  DatabaseIcon,
  KeyRoundIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  RocketIcon,
  ScrollTextIcon,
  ServerIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
} from "lucide-react"

import {
  StateBadge,
  toneClasses,
  type BadgeSize,
  type Tone,
} from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import {
  auditActionFamily,
  auditSourceLabel,
  type AuditActor,
  type AuditActorKind,
  type AuditSource,
} from "@/lib/data/audit"
import { AgentChip } from "../shared"

/* ------------------------------------------------------------------------ */
/* Sources                                                                   */
/* ------------------------------------------------------------------------ */

export const sourceIcon: Record<AuditSource, React.ReactNode> = {
  prompt: <ScrollTextIcon />,
  guardrail: <ShieldCheckIcon />,
  release: <RocketIcon />,
  review: <ClipboardCheckIcon />,
  "tool-permission": <WrenchIcon />,
  "mcp-server": <ServerIcon />,
  budget: <CoinsIcon />,
  memory: <DatabaseIcon />,
  "api-key": <KeyRoundIcon />,
  "agent-config": <SlidersHorizontalIcon />,
  readiness: <ClipboardListIcon />,
}

export function SourceChip({
  source,
  className,
}: {
  source: AuditSource
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5",
        className
      )}
    >
      {sourceIcon[source]}
      <span className="truncate">{auditSourceLabel[source]}</span>
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Targets                                                                   */
/* ------------------------------------------------------------------------ */

const targetKindLabels: Record<string, string> = {
  "prompt-version": "Prompt version",
  guardrail: "Guardrail policy",
  release: "Release",
  "release-gate": "Release gate",
  trace: "Trace",
  tool: "Tool",
  permission: "Tool permission",
  "mcp-server": "MCP server",
  budget: "Budget",
  "memory-store": "Memory store",
  "api-key": "API key",
  agent: "Agent",
  assessment: "Readiness assessment",
  snapshot: "Readiness snapshot",
  control: "Readiness control",
  "audit-log": "Audit log",
}

/** Human label for `AuditTarget.kind` (the raw value is a slug). */
export function targetKindLabel(kind: string) {
  return (
    targetKindLabels[kind] ??
    kind.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  )
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

const dangerVerbs =
  /(rolled_back|failed|rejected|revoked|breached|disconnected|escalated|user_deleted|dismissed)$/
const successVerbs =
  /(promoted|approved|granted|passed|verified|resumed|registered|enabled|enforced)$/
const warningVerbs =
  /(disabled|deprecated|paused|degraded|expiry_warning|changes_requested|requested|advisory|reopened)$/
const infoVerbs =
  /(changed|updated|rotated|compacted|advanced|annotated|triggered|taken|deployed)$/

/** Semantic tone for a dotted action verb, keyed on its last segment. */
export function actionTone(action: string): Tone {
  if (dangerVerbs.test(action)) return "danger"
  if (successVerbs.test(action)) return "success"
  if (warningVerbs.test(action)) return "warning"
  if (infoVerbs.test(action)) return "info"
  return "neutral"
}

export function actionFamilyLabel(family: string) {
  const label: Record<string, string> = {
    prompt: "Prompt",
    guardrail: "Guardrail",
    release: "Release",
    review: "Review",
    tool: "Tool",
    mcp_server: "MCP server",
    budget: "Budget",
    memory: "Memory",
    api_key: "API key",
    agent: "Agent",
    readiness: "Readiness",
    audit: "Audit",
  }
  return label[family] ?? family
}

export function ActionBadge({
  action,
  size = "sm",
  className,
}: {
  action: string
  size?: BadgeSize
  className?: string
}) {
  return (
    <StateBadge
      state={action}
      tone={actionTone(action)}
      size={size}
      dot={false}
      className={cn("font-mono tracking-tight", className)}
    />
  )
}

export function actionFamilies(actions: string[]) {
  return [...new Set(actions.map(auditActionFamily))].sort()
}

/* ------------------------------------------------------------------------ */
/* Actors                                                                    */
/* ------------------------------------------------------------------------ */

export const actorKindLabel: Record<AuditActorKind, string> = {
  user: "Person",
  agent: "Agent",
  system: "System",
}

const actorKindTone: Record<AuditActorKind, Tone> = {
  user: "neutral",
  agent: "progress",
  system: "muted",
}

export function ActorKindBadge({
  kind,
  size = "sm",
}: {
  kind: AuditActorKind
  size?: BadgeSize
}) {
  return (
    <StateBadge
      state={actorKindLabel[kind]}
      tone={actorKindTone[kind]}
      size={size}
      dot={false}
      icon={
        kind === "agent" ? (
          <BotIcon />
        ) : kind === "system" ? (
          <CpuIcon />
        ) : undefined
      }
    />
  )
}

export function ActorChip({
  actor,
  size = "xs",
  className,
}: {
  actor: AuditActor
  size?: "xs" | "sm"
  className?: string
}) {
  if (actor.kind === "user")
    return <UserChip userId={actor.id} size={size} className={className} />
  if (actor.kind === "agent")
    return (
      <AgentChip
        agentId={actor.id}
        size={size === "xs" ? "sm" : "default"}
        className={className}
      />
    )
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        size === "xs" ? "text-xs" : "text-sm",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full",
          toneClasses.muted.soft
        )}
      >
        <CpuIcon className="size-3" />
      </span>
      {actor.name}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Hash                                                                      */
/* ------------------------------------------------------------------------ */

export function HashChip({
  value,
  className,
  short = true,
}: {
  value: string
  className?: string
  short?: boolean
}) {
  const genesis = /^0+$/.test(value)
  return (
    <Badge
      variant="outline"
      title={value}
      className={cn(
        "h-5 px-1.5 font-mono text-2xs tracking-tight tabular-nums",
        genesis && "text-muted-foreground",
        className
      )}
    >
      {genesis
        ? "genesis"
        : short
          ? `${value.slice(0, 6)}…${value.slice(-4)}`
          : value}
    </Badge>
  )
}
