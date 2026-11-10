"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ActivityIcon,
  BotIcon,
  BugIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  FileCheckIcon,
  FileDiffIcon,
  ListRestartIcon,
  MoreHorizontalIcon,
  PlugZapIcon,
  PlusIcon,
  RefreshCwIcon,
  ScanSearchIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UnplugIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { NOW } from "@/lib/data/seed"
import {
  mcpPollIntervalSec,
  serverNeedsReview,
  type McpAuth,
  type McpServer,
  type McpTransport,
} from "@/lib/data/tools"
import { currentUser } from "@/lib/data/users"
import { formatDate, formatMs, formatNumber, timeAgo } from "@/lib/format"
import { AgentChip } from "../shared"
import {
  AgentStack,
  AuthBadge,
  RiskBadge,
  ServerStatusBadge,
  TransportBadge,
} from "./shared"
import { serverStore, toolStore } from "./store"

export function McpServersTab({
  openId,
  onOpen,
  onOpenTool,
}: {
  openId: string | null
  onOpen: (id: string | null) => void
  onOpenTool: (name: string) => void
}) {
  const items = serverStore.use()
  const open = items.find((s) => s.id === openId) ?? null
  const patch = React.useCallback(
    (id: string, p: Partial<McpServer>) => serverStore.patch(id, p),
    []
  )

  const actions = useServerActions(patch)
  const connected = items.filter((s) => s.status === "Connected").length
  const unhealthy = items.filter((s) => s.status !== "Connected")
  const integrity = items.filter(
    (s) =>
      serverNeedsReview(s) ||
      !s.signatureVerified ||
      s.vulnerabilities.critical > 0
  )
  const toolCount = items.reduce((n, s) => n + s.toolNames.length, 0)
  const avgLatency = Math.round(
    items.reduce((n, s) => n + s.avgLatencyMs, 0) / Math.max(1, items.length)
  )

  return (
    <div className="flex flex-col gap-6">
      <StatGrid columns={4}>
        <StatCard
          label="Servers"
          value={items.length}
          hint={`${connected} connected · ${items.filter((s) => s.transport === "stdio").length} local`}
        />
        <StatCard
          label="Tools exposed"
          value={toolCount}
          hint={`${items.reduce((n, s) => n + s.resources, 0)} resources · ${items.reduce((n, s) => n + s.prompts, 0)} prompts`}
        />
        <StatCard
          label="Integrity findings"
          value={
            <span className={cn(integrity.length > 0 && "text-warning-text")}>
              {integrity.length}
            </span>
          }
          upIsGood={false}
          hint={
            integrity.length
              ? "Unreviewed changes, unsigned builds or critical CVEs"
              : `Avg latency ${formatMs(avgLatency)} · all definitions reviewed`
          }
        />
        <StatCard
          label="Needs attention"
          value={
            <span className={cn(unhealthy.length > 0 && "text-warning-text")}>
              {unhealthy.length}
            </span>
          }
          upIsGood={false}
          hint={
            unhealthy.length
              ? unhealthy.map((s) => s.name).join(", ")
              : "Every server is healthy"
          }
        />
      </StatGrid>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Servers are polled every {mcpPollIntervalSec}s. Tool lists are
          refreshed on connect and whenever the server sends{" "}
          <code className="rounded-sm bg-muted px-1 font-mono text-xs">
            tools/list_changed
          </code>
          .
        </p>
        <AddServerButton onCreated={onOpen} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ServerIcon />}
          title="No MCP servers"
          description="Connect a server to expose its tools to agents."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((s) => (
            <li key={s.id} className="min-w-0">
              <ServerCard
                server={s}
                onOpen={() => onOpen(s.id)}
                actions={actions}
              />
            </li>
          ))}
        </ul>
      )}

      <ServerSheet
        server={open}
        onClose={() => onOpen(null)}
        actions={actions}
        onOpenTool={onOpenTool}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

interface ServerActions {
  reconnect: (s: McpServer) => void
  refresh: (s: McpServer) => void
  revoke: (s: McpServer) => void
  markReviewed: (s: McpServer) => void
  rescan: (s: McpServer) => void
}

function useServerActions(
  patch: (id: string, p: Partial<McpServer>) => void
): ServerActions {
  return React.useMemo(
    () => ({
      reconnect: (s) => {
        patch(s.id, {
          status: "Connected",
          note: undefined,
          lastHealthCheck: NOW.toISOString(),
        })
        toast.success(`${s.name} marked connected`, {
          description: `Handshake recorded on ${s.transport} · protocol ${s.protocolVersion}`,
        })
      },
      refresh: (s) => {
        patch(s.id, { lastHealthCheck: NOW.toISOString() })
        toast(`${s.name} re-read`, {
          description: `${s.toolNames.length} tools, ${s.resources} resources, ${s.prompts} prompts advertised; health check time updated.`,
        })
      },
      revoke: (s) => {
        patch(s.id, {
          status: "Disconnected",
          note: "Credentials revoked by an operator. Reconnect to re-authorize.",
        })
        toast(`${s.name} credentials revoked`, {
          description: `${s.agentIds.length} agent${s.agentIds.length === 1 ? "" : "s"} lost ${s.toolNames.length} tool${s.toolNames.length === 1 ? "" : "s"}`,
        })
      },
      markReviewed: (s) => {
        patch(s.id, {
          reviewedAt: NOW.toISOString(),
          reviewerId: currentUser.id,
        })
        toast.success(`${s.name} definitions reviewed`, {
          description: `Digest ${s.definitionDigest} signed off by ${currentUser.name}`,
        })
      },
      rescan: (s) => {
        const v = s.vulnerabilities
        patch(s.id, {
          vulnerabilities: { ...v, scannedAt: NOW.toISOString() },
        })
        toast(`Scan recorded for ${s.name}`, {
          description: `${v.critical} critical · ${v.high} high · ${v.medium} medium; counts unchanged, scan time updated.`,
        })
      },
    }),
    [patch]
  )
}

/* ------------------------------------------------------------------------ */
/* Add server                                                                */
/* ------------------------------------------------------------------------ */

const transportItems: { value: McpTransport; label: string }[] = [
  { value: "streamable-http", label: "Streamable HTTP" },
  { value: "stdio", label: "stdio (local process)" },
  { value: "sse", label: "SSE (legacy)" },
]
const authItems: { value: McpAuth; label: string }[] = [
  { value: "OAuth 2.1", label: "OAuth 2.1" },
  { value: "API key", label: "API key" },
  { value: "mTLS", label: "mTLS" },
  { value: "none", label: "No auth" },
]

/** Small deterministic digest so new servers look like the seeded ones. */
function digestOf(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0").repeat(5).slice(0, 40)
}

function AddServerButton({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [transport, setTransport] =
    React.useState<McpTransport>("streamable-http")
  const [endpoint, setEndpoint] = React.useState("")
  const [auth, setAuth] = React.useState<McpAuth>("OAuth 2.1")

  const id = `mcp-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`
  const taken = serverStore.get().some((s) => s.id === id)
  const canSave = name.trim().length > 1 && endpoint.trim() && !taken

  const reset = () => {
    setName("")
    setDescription("")
    setTransport("streamable-http")
    setEndpoint("")
    setAuth("OAuth 2.1")
  }

  const save = () => {
    const now = NOW.toISOString()
    const server: McpServer = {
      id,
      name: name.trim(),
      description: description.trim() || "Added from the registry.",
      transport,
      endpoint: endpoint.trim(),
      auth,
      status: "Connected",
      version: "0.1.0",
      protocolVersion: "2025-06-18",
      toolNames: [],
      resources: 0,
      prompts: 0,
      lastHealthCheck: now,
      avgLatencyMs: 0,
      uptime30d: 100,
      agentIds: [],
      ownerId: currentUser.id,
      definitionDigest: digestOf(`${id}@0.1.0`),
      lastDefinitionChange: now,
      signatureVerified: false,
      egressAllowlist: [],
      vulnerabilities: { critical: 0, high: 0, medium: 0, scannedAt: now },
    }
    serverStore.add(server, "start")
    toast.success(`${server.name} added`, {
      description:
        "Connected with no tools advertised yet. It is unsigned until a publisher signature is verified; review its definitions before granting agents.",
    })
    reset()
    setOpen(false)
    onCreated(server.id)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add server
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Add MCP server</SheetTitle>
            <SheetDescription>
              Registers the server as Connected with an empty tool list. Tools
              appear once the server advertises them.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="server-name">Name</FieldLabel>
                <Input
                  id="server-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="jira"
                  autoComplete="off"
                  className="font-mono"
                />
                <FieldDescription>
                  {taken ? `${id} already exists.` : `Id ${id}`}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="server-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="server-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What the server exposes and who owns it."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="server-transport">Transport</FieldLabel>
                  <Select
                    value={transport}
                    onValueChange={(v) => v && setTransport(v as McpTransport)}
                    items={transportItems}
                  >
                    <SelectTrigger id="server-transport" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transportItems.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="server-auth">Auth</FieldLabel>
                  <Select
                    value={auth}
                    onValueChange={(v) => v && setAuth(v as McpAuth)}
                    items={authItems}
                  >
                    <SelectTrigger id="server-auth" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {authItems.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="server-endpoint">
                  {transport === "stdio" ? "Command" : "Endpoint"}
                </FieldLabel>
                <Input
                  id="server-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder={
                    transport === "stdio"
                      ? "npx -y @vendor/mcp-server"
                      : "https://mcp.example.com/v1"
                  }
                  autoComplete="off"
                  className="font-mono"
                />
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button disabled={!canSave} onClick={save}>
                Add server
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */

function ServerCard({
  server: s,
  onOpen,
  actions,
}: {
  server: McpServer
  onOpen: () => void
  actions: ServerActions
}) {
  const tools = toolStore.use()
  const [toolsOpen, setToolsOpen] = React.useState(false)
  const [confirmRevoke, setConfirmRevoke] = React.useState(false)
  return (
    <Card
      size="sm"
      className={cn(
        "h-full gap-3",
        s.status === "Disconnected" && "border-destructive/30",
        s.status === "Degraded" && "border-warning/40"
      )}
    >
      <CardHeader className="gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="flex min-w-0 items-center gap-2 text-left font-mono text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-md border",
                  s.status === "Connected"
                    ? "border-brand/30 bg-brand/10 text-brand"
                    : s.status === "Degraded"
                      ? "border-warning/40 bg-warning/10 text-warning-text"
                      : "border-destructive/30 bg-destructive/10 text-danger-text"
                )}
              >
                <PlugZapIcon className="size-3.5" aria-hidden />
              </span>
              <span className="truncate">{s.name}</span>
            </button>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            <ServerStatusBadge status={s.status} size="sm" />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${s.name}`}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => actions.reconnect(s)}>
                  <RefreshCwIcon /> Reconnect
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.refresh(s)}>
                  <ListRestartIcon /> Refresh tool list
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!serverNeedsReview(s)}
                  onClick={() => actions.markReviewed(s)}
                >
                  <FileCheckIcon /> Mark reviewed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.rescan(s)}>
                  <ScanSearchIcon /> Re-scan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmRevoke(true)}
                >
                  <UnplugIcon /> Revoke credentials
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardDescription className="line-clamp-2 text-xs leading-relaxed">
          {s.description}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <TransportBadge transport={s.transport} />
          <AuthBadge auth={s.auth} />
          <span className="font-mono text-2xs text-muted-foreground">
            v{s.version}
          </span>
        </div>
        <IntegrityBadges server={s} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p
          className="truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-2xs text-muted-foreground"
          title={s.endpoint}
        >
          {s.endpoint}
        </p>
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Mini label="Tools" value={s.toolNames.length} />
          <Mini label="Resources" value={s.resources} />
          <Mini label="Prompts" value={s.prompts} />
          <Mini
            label="Latency"
            value={formatMs(s.avgLatencyMs)}
            tone={
              s.avgLatencyMs >= 2000
                ? "danger"
                : s.avgLatencyMs >= 1000
                  ? "warning"
                  : undefined
            }
          />
        </dl>
        {s.note && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning-text">
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{s.note}</span>
          </p>
        )}
        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="-ml-2 text-muted-foreground"
              />
            }
          >
            <ChevronDownIcon
              className={cn("transition-transform", toolsOpen && "rotate-180")}
            />
            {toolsOpen ? "Hide" : "Show"} {s.toolNames.length} tool
            {s.toolNames.length === 1 ? "" : "s"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            {s.toolNames.length === 0 ? (
              <p className="pt-1 text-xs text-muted-foreground">
                No tools advertised.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1 pt-1">
                {s.toolNames.map((n) => {
                  const t = tools.find((x) => x.name === n)
                  return (
                    <li key={n}>
                      <code
                        className={cn(
                          "rounded-sm border bg-background px-1.5 py-0.5 font-mono text-2xs",
                          t?.status !== "Active" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {n}
                      </code>
                    </li>
                  )
                })}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <CardFooter className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ActivityIcon className="size-3.5" aria-hidden />
          Checked {timeAgo(s.lastHealthCheck)}
        </span>
        <AgentStack agentIds={s.agentIds} />
      </CardFooter>

      <RevokeDialog
        server={s}
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        onConfirm={() => actions.revoke(s)}
      />
    </Card>
  )
}

/** Signature, digest, review state and vulns in one wrapping row. */
function IntegrityBadges({
  server: s,
  className,
}: {
  server: McpServer
  className?: string
}) {
  const changed = serverNeedsReview(s)
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Badge
        variant="outline"
        title={
          s.signatureVerified
            ? "Publisher signature verified"
            : "Signature could not be verified: unpinned or unsigned build"
        }
        className={cn(
          "h-5 gap-1 px-1.5 text-2xs font-medium",
          s.signatureVerified
            ? "border-success/30 bg-success/10 text-success-text"
            : "border-destructive/30 bg-destructive/10 text-danger-text"
        )}
      >
        {s.signatureVerified ? (
          <ShieldCheckIcon className="size-3" aria-hidden />
        ) : (
          <ShieldOffIcon className="size-3" aria-hidden />
        )}
        {s.signatureVerified ? "Signed" : "Unsigned"}
      </Badge>
      <span
        className="font-mono text-2xs text-muted-foreground"
        title={`Definition digest sha256:${s.definitionDigest}`}
      >
        {s.definitionDigest.slice(0, 7)}
      </span>
      {changed && (
        <Badge
          variant="outline"
          title={
            s.reviewedAt
              ? `Definitions changed ${timeAgo(s.lastDefinitionChange)}, last reviewed ${timeAgo(s.reviewedAt)}`
              : "Definitions have never been reviewed"
          }
          className="h-5 gap-1 border-warning/40 bg-warning/10 px-1.5 text-2xs font-medium text-warning-text"
        >
          <FileDiffIcon className="size-3" aria-hidden />
          Changed since review
        </Badge>
      )}
      <VulnBadge server={s} />
    </div>
  )
}

function VulnBadge({ server: s }: { server: McpServer }) {
  const v = s.vulnerabilities
  const total = v.critical + v.high + v.medium
  const tone =
    v.critical > 0
      ? "border-destructive/30 bg-destructive/10 text-danger-text"
      : v.high > 0
        ? "border-warning/40 bg-warning/10 text-warning-text"
        : "text-muted-foreground"
  return (
    <Badge
      variant="outline"
      title={`${v.critical} critical · ${v.high} high · ${v.medium} medium; scanned ${timeAgo(v.scannedAt)}`}
      className={cn("h-5 gap-1 px-1.5 text-2xs font-medium", tone)}
    >
      <BugIcon className="size-3" aria-hidden />
      {total === 0 ? (
        "No vulns"
      ) : (
        <span className="tabular-nums">
          {v.critical}C · {v.high}H
        </span>
      )}
    </Badge>
  )
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone?: "warning" | "danger"
}) {
  return (
    <div className="min-w-0">
      <Eyebrow as="span" className="block truncate text-3xs">
        {label}
      </Eyebrow>
      <dd
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "danger" && "text-danger-text",
          tone === "warning" && "text-warning-text"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function RevokeDialog({
  server: s,
  open,
  onOpenChange,
  onConfirm,
}: {
  server: McpServer
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Revoke credentials for{" "}
            <code className="font-mono text-base">{s.name}</code>?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The {s.auth === "none" ? "session" : s.auth} grant is invalidated
            and the server disconnects. {s.agentIds.length} agent
            {s.agentIds.length === 1 ? "" : "s"} lose {s.toolNames.length} tool
            {s.toolNames.length === 1 ? "" : "s"} until an operator
            re-authorizes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            <UnplugIcon /> Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ------------------------------------------------------------------------ */
/* Sheet                                                                     */
/* ------------------------------------------------------------------------ */

function DisabledHint({
  reason,
  children,
}: {
  reason: string | null
  children: React.ReactElement
}) {
  if (!reason) return children
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}

function ServerSheet({
  server: s,
  onClose,
  actions,
  onOpenTool,
}: {
  server: McpServer | null
  onClose: () => void
  actions: ServerActions
  onOpenTool: (name: string) => void
}) {
  const tools = toolStore.use()
  const [confirmRevoke, setConfirmRevoke] = React.useState(false)
  const alreadyRevoked = s ? s.status === "Disconnected" && !!s.note : false
  return (
    <Sheet open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {s && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ServerStatusBadge status={s.status} />
                <TransportBadge transport={s.transport} />
                <AuthBadge auth={s.auth} />
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
                  {s.id} <CopyButton value={s.id} label="Copy server id" />
                </span>
              </div>
              <SheetTitle className="font-mono text-lg leading-tight">
                {s.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed text-foreground/80">
                {s.description}
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                {s.note && (
                  <section
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
                      s.status === "Disconnected"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-warning/40 bg-warning/5"
                    )}
                  >
                    <CircleAlertIcon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        s.status === "Disconnected"
                          ? "text-danger-text"
                          : "text-warning"
                      )}
                    />
                    <p className="leading-relaxed">{s.note}</p>
                  </section>
                )}

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricTile label="Tools" value={s.toolNames.length} />
                  <MetricTile label="Resources" value={s.resources} />
                  <MetricTile label="Prompts" value={s.prompts} />
                  <MetricTile
                    label="Uptime · 30d"
                    value={s.uptime30d.toFixed(2)}
                    unit="%"
                    tone={s.uptime30d < 99.5 ? "warning" : undefined}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Connection</h3>
                  <DetailList
                    variant="rows"
                    dense
                    items={[
                      {
                        label: "Transport",
                        value: <TransportBadge transport={s.transport} />,
                      },
                      {
                        label: s.transport === "stdio" ? "Command" : "Endpoint",
                        value: s.endpoint,
                        mono: true,
                        copyable: true,
                      },
                      { label: "Auth", value: <AuthBadge auth={s.auth} /> },
                      {
                        label: "Server version",
                        value: `v${s.version}`,
                        mono: true,
                      },
                      {
                        label: "Protocol",
                        value: s.protocolVersion,
                        mono: true,
                        hint:
                          s.protocolVersion < "2025-06-18"
                            ? "Older protocol revision: structured tool output and elicitation are unavailable."
                            : undefined,
                      },
                      {
                        label: "Last health check",
                        value: timeAgo(s.lastHealthCheck),
                      },
                      {
                        label: "Avg latency",
                        value: formatMs(s.avgLatencyMs),
                      },
                      {
                        label: "Owner",
                        value: <UserChip userId={s.ownerId} size="xs" />,
                      },
                    ]}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Integrity</h3>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => actions.rescan(s)}
                      >
                        <ScanSearchIcon /> Re-scan
                      </Button>
                      <DisabledHint
                        reason={
                          serverNeedsReview(s)
                            ? null
                            : "Definitions have not changed since the last review"
                        }
                      >
                        <Button
                          size="sm"
                          variant={serverNeedsReview(s) ? "default" : "outline"}
                          className="h-7 text-xs"
                          disabled={!serverNeedsReview(s)}
                          onClick={() => actions.markReviewed(s)}
                        >
                          <FileCheckIcon /> Mark reviewed
                        </Button>
                      </DisabledHint>
                    </div>
                  </div>
                  <IntegrityBadges server={s} />
                  <DetailList
                    variant="rows"
                    dense
                    items={[
                      {
                        label: "Definition digest",
                        value: `sha256:${s.definitionDigest}`,
                        mono: true,
                        copyable: true,
                        copyValue: s.definitionDigest,
                        hint: `Changed ${timeAgo(s.lastDefinitionChange)}`,
                      },
                      {
                        label: "Reviewed",
                        value: s.reviewedAt ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            {s.reviewerId && (
                              <UserChip userId={s.reviewerId} size="xs" />
                            )}
                            <span className="text-muted-foreground">
                              {timeAgo(s.reviewedAt)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-warning-text">Never</span>
                        ),
                        hint: serverNeedsReview(s)
                          ? "The advertised tools or resources changed after this review."
                          : undefined,
                      },
                      {
                        label: "Signature",
                        value: s.signatureVerified
                          ? "Verified against publisher key"
                          : "Not verified",
                        hint: s.signatureVerified
                          ? undefined
                          : "Pin the package version and require a signed build before trusting its tool list.",
                      },
                      {
                        label: "Vulnerabilities",
                        value: (
                          <span className="tabular-nums">
                            {s.vulnerabilities.critical} critical ·{" "}
                            {s.vulnerabilities.high} high ·{" "}
                            {s.vulnerabilities.medium} medium
                          </span>
                        ),
                        hint: `Scanned ${timeAgo(s.vulnerabilities.scannedAt)}`,
                      },
                      {
                        label: "End of life",
                        value: s.eolDate ? (
                          <span className="text-warning-text">
                            {formatDate(s.eolDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Not announced
                          </span>
                        ),
                      },
                      {
                        label: "Egress allowlist",
                        wide: true,
                        value:
                          s.egressAllowlist.length === 0 ? (
                            <span className="text-muted-foreground">
                              {s.transport === "stdio"
                                ? "None declared; process has no pinned hosts"
                                : "None declared"}
                            </span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {s.egressAllowlist.map((h) => (
                                <Badge
                                  key={h}
                                  variant="outline"
                                  className="h-5 px-1.5 font-mono text-2xs text-muted-foreground"
                                >
                                  {h}
                                </Badge>
                              ))}
                            </span>
                          ),
                      },
                    ]}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Tools exposed{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      · {s.toolNames.length}
                    </span>
                  </h3>
                  {s.toolNames.length === 0 ? (
                    <EmptyState
                      size="sm"
                      icon={<WrenchIcon />}
                      title="No tools advertised"
                      description="The server connected but tools/list returned nothing."
                    />
                  ) : (
                    <ul className="flex flex-col divide-y rounded-lg border">
                      {s.toolNames.map((n) => {
                        const t = tools.find((x) => x.name === n)
                        return (
                          <li key={n}>
                            <button
                              type="button"
                              onClick={() => onOpenTool(n)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                            >
                              <span className="min-w-0">
                                <span
                                  className={cn(
                                    "block truncate font-mono text-xs font-medium",
                                    t?.status !== "Active" &&
                                      "text-muted-foreground"
                                  )}
                                >
                                  {n}
                                </span>
                                {t && (
                                  <span className="block truncate text-2xs text-muted-foreground">
                                    {t.description}
                                  </span>
                                )}
                              </span>
                              {t && (
                                <span className="flex shrink-0 items-center gap-2 text-2xs text-muted-foreground tabular-nums">
                                  {formatNumber(t.calls24h, true)} / 24h
                                  <RiskBadge risk={t.risk} size="sm" />
                                </span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Attached agents{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      · {s.agentIds.length}
                    </span>
                  </h3>
                  {s.agentIds.length === 0 ? (
                    <EmptyState
                      size="sm"
                      icon={<BotIcon />}
                      title="No agents attached"
                      description="None of this server's tools are allowlisted yet."
                    />
                  ) : (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {s.agentIds.map((id) => (
                        <li key={id}>
                          <AgentChip agentId={id} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </SheetBody>

            <SheetFooterActions
              tertiary={
                <DisabledHint
                  reason={
                    alreadyRevoked ? "Credentials are already revoked" : null
                  }
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-text hover:text-danger-text"
                    onClick={() => setConfirmRevoke(true)}
                    disabled={alreadyRevoked}
                  >
                    <UnplugIcon /> Revoke
                  </Button>
                </DisabledHint>
              }
              secondary={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => actions.refresh(s)}
                >
                  <ListRestartIcon /> Refresh tool list
                </Button>
              }
              primary={
                <Button
                  size="sm"
                  variant={s.status === "Connected" ? "outline" : "default"}
                  onClick={() => actions.reconnect(s)}
                >
                  <RefreshCwIcon /> Reconnect
                </Button>
              }
            />

            <RevokeDialog
              server={s}
              open={confirmRevoke}
              onOpenChange={setConfirmRevoke}
              onConfirm={() => actions.revoke(s)}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
