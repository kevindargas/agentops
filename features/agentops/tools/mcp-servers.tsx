"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ActivityIcon,
  BotIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ListRestartIcon,
  MoreHorizontalIcon,
  PlugZapIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  UnplugIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { UserChip } from "@/components/shared/user-chip"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getTool, mcpServers as seed, type McpServer } from "@/lib/data/tools"
import { formatNumber, timeAgo } from "@/lib/format"
import { AgentChip, fmtMs } from "../shared"
import {
  AgentStack,
  AuthBadge,
  RiskBadge,
  ServerStatusBadge,
  TransportBadge,
} from "./shared"

export function McpServersTab({
  openId,
  onOpen,
  onOpenTool,
}: {
  openId: string | null
  onOpen: (id: string | null) => void
  onOpenTool: (name: string) => void
}) {
  const [items, setItems] = React.useState<McpServer[]>(seed)
  const open = items.find((s) => s.id === openId) ?? null
  const patch = (id: string, p: Partial<McpServer>) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const actions = useServerActions(patch)
  const connected = items.filter((s) => s.status === "Connected").length
  const unhealthy = items.filter((s) => s.status !== "Connected")
  const toolCount = items.reduce((n, s) => n + s.toolNames.length, 0)
  const avgLatency = Math.round(
    items.reduce((n, s) => n + s.avgLatencyMs, 0) / Math.max(1, items.length)
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Servers"
          value={items.length}
          hint={`${connected} connected · ${items.filter((s) => s.transport === "stdio").length} local`}
        />
        <StatCard
          size="sm"
          label="Tools exposed"
          value={toolCount}
          hint={`${items.reduce((n, s) => n + s.resources, 0)} resources · ${items.reduce((n, s) => n + s.prompts, 0)} prompts`}
        />
        <StatCard
          size="sm"
          label="Avg latency"
          value={fmtMs(avgLatency)}
          hint="Mean across servers, last hour"
        />
        <StatCard
          size="sm"
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
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Servers are polled every 30s. Tool lists are refreshed on connect and
          whenever the server sends{" "}
          <code className="rounded-sm bg-muted px-1 font-mono text-xs">
            tools/list_changed
          </code>
          .
        </p>
        <Button size="sm" onClick={() => toast("Add MCP server wizard opened")}>
          <PlusIcon /> Add server
        </Button>
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
}

function useServerActions(
  patch: (id: string, p: Partial<McpServer>) => void
): ServerActions {
  return React.useMemo(
    () => ({
      reconnect: (s) => {
        patch(s.id, { status: "Connected", note: undefined })
        toast.success(`${s.name} reconnected`, {
          description: `Handshake completed on ${s.transport} · protocol ${s.protocolVersion}`,
        })
      },
      refresh: (s) => {
        toast(`Tool list refreshed for ${s.name}`, {
          description: `${s.toolNames.length} tools, ${s.resources} resources, ${s.prompts} prompts — no changes`,
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
    }),
    [patch]
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
          <span className="font-mono text-[11px] text-muted-foreground">
            v{s.version}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p
          className="truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
          title={s.endpoint}
        >
          {s.endpoint}
        </p>
        <dl className="grid grid-cols-4 gap-2 text-xs">
          <Mini label="Tools" value={s.toolNames.length} />
          <Mini label="Resources" value={s.resources} />
          <Mini label="Prompts" value={s.prompts} />
          <Mini
            label="Latency"
            value={fmtMs(s.avgLatencyMs)}
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
                  const t = getTool(n)
                  return (
                    <li key={n}>
                      <code
                        className={cn(
                          "rounded-sm border bg-background px-1.5 py-0.5 font-mono text-[11px]",
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
      <dt className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
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
  const [confirmRevoke, setConfirmRevoke] = React.useState(false)
  return (
    <Sheet open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {s && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ServerStatusBadge status={s.status} />
                <TransportBadge transport={s.transport} />
                <AuthBadge auth={s.auth} />
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                  <Fact label="Tools" value={s.toolNames.length} />
                  <Fact label="Resources" value={s.resources} />
                  <Fact label="Prompts" value={s.prompts} />
                  <Fact
                    label="Uptime · 30d"
                    value={`${s.uptime30d.toFixed(2)}%`}
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
                            ? "Older protocol revision — structured tool output and elicitation are unavailable."
                            : undefined,
                      },
                      {
                        label: "Last health check",
                        value: timeAgo(s.lastHealthCheck),
                      },
                      {
                        label: "Avg latency",
                        value: fmtMs(s.avgLatencyMs),
                      },
                      {
                        label: "Owner",
                        value: <UserChip userId={s.ownerId} size="xs" />,
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
                        const t = getTool(n)
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
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {t.description}
                                  </span>
                                )}
                              </span>
                              {t && (
                                <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
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
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-danger-text hover:text-danger-text"
                onClick={() => setConfirmRevoke(true)}
                disabled={s.status === "Disconnected" && !!s.note}
              >
                <UnplugIcon /> Revoke
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.refresh(s)}
              >
                <ListRestartIcon /> Refresh tool list
              </Button>
              <Button
                size="sm"
                variant={s.status === "Connected" ? "outline" : "default"}
                onClick={() => actions.reconnect(s)}
              >
                <RefreshCwIcon /> Reconnect
              </Button>
            </div>

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

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone?: "warning" | "danger"
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "danger" && "text-danger-text",
          tone === "warning" && "text-warning-text"
        )}
      >
        {value}
      </p>
    </div>
  )
}
