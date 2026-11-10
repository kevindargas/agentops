"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ArrowRightIcon,
  BotIcon,
  BracesIcon,
  CircleAlertIcon,
  PowerIcon,
  PowerOffIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { getDeployedAgent } from "@/lib/data"
import {
  toolApprovals,
  type Tool,
  type ToolApproval,
  type ToolInputSchema,
} from "@/lib/data/tools"
import { formatNumber, timeAgo } from "@/lib/format"
import { AgentChip, fmtMs } from "../shared"
import {
  ApprovalBadge,
  approvalMeta,
  fmtPct,
  RiskBadge,
  SourceChip,
  ToolStatusBadge,
} from "./shared"

export function ToolSheet({
  tool: t,
  onClose,
  onPatch,
  onOpenTool,
  onOpenServer,
}: {
  tool: Tool | null
  onClose: () => void
  onPatch: (name: string, p: Partial<Tool>) => void
  onOpenTool: (name: string) => void
  onOpenServer: (id: string) => void
}) {
  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const params = t ? schemaRows(t.inputSchema) : []
  const json = t ? JSON.stringify(t.inputSchema, null, 2) : ""

  return (
    <Sheet open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {t && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ToolStatusBadge status={t.status} />
                <RiskBadge risk={t.risk} />
                <ApprovalBadge approval={t.approval} />
                <SourceChip
                  source={t.source}
                  className="ml-auto"
                  onServerClick={onOpenServer}
                />
              </div>
              <SheetTitle className="flex items-center gap-2 font-mono text-lg leading-tight">
                {t.name}
                <CopyButton value={t.name} label="Copy tool name" />
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed text-foreground/80">
                {t.description}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                {t.status === "Deprecated" && t.replacedBy && (
                  <section className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
                    <p className="min-w-0 flex-1">
                      Deprecated alias. New prompts should call{" "}
                      <code className="rounded-sm bg-muted px-1 font-mono text-xs">
                        {t.replacedBy}
                      </code>
                      .
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onOpenTool(t.replacedBy!)}
                    >
                      Open successor <ArrowRightIcon />
                    </Button>
                  </section>
                )}
                {t.status === "Disabled" && (
                  <section className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                    <PowerOffIcon className="size-4 shrink-0 text-danger-text" />
                    <p>
                      Disabled. The tool is hidden from every agent&apos;s tool
                      list and calls fail closed.
                    </p>
                  </section>
                )}

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Kpi
                    label="Calls · 24h"
                    value={formatNumber(t.calls24h)}
                    foot={
                      <Sparkline
                        data={t.calls14d}
                        className="h-7 w-full"
                        color={
                          t.status === "Deprecated"
                            ? "var(--chart-5)"
                            : "var(--chart-1)"
                        }
                        showEndDot={false}
                      />
                    }
                    footLabel="14-day calls"
                  />
                  <Kpi
                    label="Error rate"
                    value={fmtPct(t.errorRate)}
                    tone={
                      t.errorRate >= 3
                        ? "danger"
                        : t.errorRate >= 1.5
                          ? "warning"
                          : undefined
                    }
                  />
                  <Kpi label="p95 latency" value={fmtMs(t.p95Ms)} />
                  <Kpi
                    label="Awaiting approval"
                    value={t.pendingApprovals}
                    tone={t.pendingApprovals > 4 ? "warning" : undefined}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Input parameters</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {params.length} field{params.length === 1 ? "" : "s"} ·{" "}
                      {t.inputSchema.required.length} required
                    </span>
                  </div>
                  {params.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      This tool takes no arguments.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[30rem] text-sm">
                        <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">
                              Name
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Type
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Required
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {params.map((row) => (
                            <tr key={row.name} className="align-top">
                              <td className="px-3 py-2 font-mono text-xs">
                                {row.name}
                              </td>
                              <td className="px-3 py-2">
                                <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground">
                                  {row.type}
                                </code>
                              </td>
                              <td className="px-3 py-2">
                                {row.required ? (
                                  <Badge
                                    variant="outline"
                                    className="h-5 border-brand/30 bg-brand/10 px-1.5 text-[10px] text-brand"
                                  >
                                    required
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    optional
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                {row.description}
                                {row.extra && (
                                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground/80">
                                    {row.extra}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <BracesIcon className="size-3.5 text-muted-foreground" />
                      JSON Schema
                    </h3>
                    <CopyButton value={json} label="Copy schema" />
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed">
                    {json}
                  </pre>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Output</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">
                    {renderInlineCode(t.outputDescription)}
                  </p>
                </section>

                <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Fact label="Rate limit">
                    <span className="tabular-nums">{t.rateLimit}</span>
                  </Fact>
                  <Fact label="Timeout">
                    <span className="tabular-nums">{fmtMs(t.timeoutMs)}</span>
                  </Fact>
                  <Fact label="Retries">
                    <span className="tabular-nums">{t.retries}</span>
                  </Fact>
                  <Fact label="Owner">
                    <UserChip userId={t.ownerId} size="xs" />
                  </Fact>
                </section>

                <section className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">
                      Allowlisted agents{" "}
                      <span className="font-normal text-muted-foreground tabular-nums">
                        · {t.agentIds.length}
                      </span>
                    </h3>
                    {t.agentIds.length === 0 ? (
                      <EmptyState
                        size="sm"
                        icon={<BotIcon />}
                        title="No agents attached"
                        description="Registered but not yet granted to any agent."
                      />
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {t.agentIds.map((id) => {
                          const a = getDeployedAgent(id)
                          return (
                            <li
                              key={id}
                              className="flex items-center justify-between gap-2"
                            >
                              <AgentChip agentId={id} size="sm" />
                              {a && (
                                <span className="text-[11px] text-muted-foreground">
                                  {a.tools.includes(t.name)
                                    ? "in deployed config"
                                    : "allowlisted"}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Recent errors</h3>
                    {t.recentErrors.length === 0 ? (
                      <EmptyState
                        size="sm"
                        icon={<CircleAlertIcon />}
                        title="No errors recorded"
                        description="Nothing failed in the last 7 days."
                      />
                    ) : (
                      <ul className="flex flex-col divide-y rounded-lg border">
                        {t.recentErrors.map((e, i) => (
                          <li
                            key={`${e.at}-${i}`}
                            className="flex flex-col gap-0.5 px-3 py-2"
                          >
                            <p className="font-mono text-[11px] leading-snug text-danger-text">
                              {e.message}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {timeAgo(e.at)} ·{" "}
                              {getDeployedAgent(e.agentId)?.name ?? e.agentId}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                {t.tags.length > 0 && (
                  <section className="flex flex-wrap items-center gap-1.5">
                    {t.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="font-mono text-[11px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </section>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Policy</span>
                <Select
                  value={t.approval}
                  disabled={t.status === "Disabled"}
                  onValueChange={(v) => {
                    if (!v || v === t.approval) return
                    const next = v as ToolApproval
                    onPatch(t.name, { approval: next })
                    toast.success(`Policy changed to “${next}”`, {
                      description: approvalMeta[next].hint,
                    })
                  }}
                  items={toolApprovals.map((a) => ({ value: a, label: a }))}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-44"
                    aria-label="Approval policy"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toolApprovals.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast("Schema editor opened")}
                >
                  <BracesIcon /> Edit schema
                </Button>
                {t.status === "Disabled" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      onPatch(t.name, { status: "Active" })
                      toast.success(`${t.name} enabled`, {
                        description:
                          "Agents will see the tool on their next turn",
                      })
                    }}
                  >
                    <PowerIcon /> Enable
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDisable(true)}
                  >
                    <PowerOffIcon /> Disable
                  </Button>
                )}
              </div>
            </div>

            <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Disable{" "}
                    <code className="font-mono text-base">{t.name}</code>?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.agentIds.length === 0
                      ? "No agent currently has this tool, so nothing will break — but it stays hidden until re-enabled."
                      : `${t.agentIds.length} agent${t.agentIds.length === 1 ? "" : "s"} will lose the tool on their next turn. In-flight calls finish; queued approvals are cancelled.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      onPatch(t.name, {
                        status: "Disabled",
                        pendingApprovals: 0,
                      })
                      setConfirmDisable(false)
                      toast(`${t.name} disabled`, {
                        description: "Calls now fail closed for every agent",
                      })
                    }}
                  >
                    <PowerOffIcon /> Disable tool
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

interface SchemaRow {
  name: string
  type: string
  required: boolean
  description: string
  extra?: string
}

export function schemaRows(schema: ToolInputSchema): SchemaRow[] {
  return Object.entries(schema.properties).map(([name, prop]) => {
    const type =
      prop.type === "array" && prop.items
        ? `${prop.items.type}[]`
        : prop.format
          ? `${prop.type} (${prop.format})`
          : prop.type
    const bits: string[] = []
    if (prop.enum) bits.push(`one of ${prop.enum.join(" | ")}`)
    if (prop.default !== undefined)
      bits.push(`default ${JSON.stringify(prop.default)}`)
    return {
      name,
      type,
      required: schema.required.includes(name),
      description: prop.description,
      extra: bits.length ? bits.join(" · ") : undefined,
    }
  })
}

/** Renders `code` spans in a plain-text description. */
function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g)
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function Kpi({
  label,
  value,
  foot,
  footLabel,
  tone,
}: {
  label: string
  value: React.ReactNode
  foot?: React.ReactNode
  footLabel?: string
  tone?: "warning" | "danger"
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "danger" && "text-danger-text",
          tone === "warning" && "text-warning-text"
        )}
      >
        {value}
      </p>
      {foot && (
        <div className="-mx-1 mt-auto" aria-label={footLabel}>
          {foot}
        </div>
      )}
    </div>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
