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
  ShieldCheckIcon,
  TriangleAlertIcon,
  Undo2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
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
import { Label } from "@/components/ui/label"
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
import { getDeployedAgent } from "@/lib/data/agentops"
import {
  getTool,
  toolApprovals,
  toolIsSandboxed,
  type Tool,
  type ToolApproval,
  type ToolInputSchema,
} from "@/lib/data/tools"
import { formatCurrency, formatMs, formatNumber, timeAgo } from "@/lib/format"
import { AgentChip } from "../shared"
import {
  ApprovalBadge,
  approvalMeta,
  Fact,
  fmtPct,
  identityModeMeta,
  IdentityModeBadge,
  RiskBadge,
  SinkChip,
  sinkMeta,
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
  const [schemaOpen, setSchemaOpen] = React.useState(false)
  const params = t ? schemaRows(t.inputSchema) : []
  const json = t ? JSON.stringify(t.inputSchema, null, 2) : ""
  const replacedBy = t?.replacedBy

  return (
    <Sheet open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
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

            <SheetBody>
              <div className="flex flex-col gap-6">
                {t.status === "Deprecated" && replacedBy && (
                  <section className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
                    <p className="min-w-0 flex-1">
                      Deprecated alias. New prompts should call{" "}
                      <code className="rounded-sm bg-muted px-1 font-mono text-xs">
                        {replacedBy}
                      </code>
                      .
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onOpenTool(replacedBy)}
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
                  <MetricTile
                    label="Calls · 24h"
                    value={formatNumber(t.calls24h)}
                    hint={
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
                  />
                  <MetricTile
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
                  <MetricTile label="p95 latency" value={formatMs(t.p95Ms)} />
                  <MetricTile
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
                    <EmptyState
                      size="sm"
                      bare
                      title="No arguments"
                      description="This tool takes no input. Edit the schema to add fields."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[30rem] text-sm">
                        <caption className="sr-only">
                          Input parameters of {t.name}
                        </caption>
                        <thead className="bg-muted/40 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
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
                                <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-2xs text-muted-foreground">
                                  {row.type}
                                </code>
                              </td>
                              <td className="px-3 py-2">
                                {row.required ? (
                                  <Badge
                                    variant="outline"
                                    className="h-5 border-brand/30 bg-brand/10 px-1.5 text-3xs text-brand"
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
                                  <span className="mt-0.5 block font-mono text-2xs text-muted-foreground/80">
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
                    <span className="tabular-nums">
                      {formatMs(t.timeoutMs)}
                    </span>
                  </Fact>
                  <Fact label="Retries">
                    <span className="tabular-nums">{t.retries}</span>
                  </Fact>
                  <Fact label="Owner">
                    <UserChip userId={t.ownerId} size="xs" />
                  </Fact>
                </section>

                <SideEffectSection tool={t} onOpenTool={onOpenTool} />
                <IdentitySection tool={t} />

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
                                <span className="text-2xs text-muted-foreground">
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
                            <p className="font-mono text-2xs leading-snug text-danger-text">
                              {e.message}
                            </p>
                            <p className="text-2xs text-muted-foreground">
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
                        className="font-mono text-2xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </section>
                )}
              </div>
            </SheetBody>

            <SheetFooterActions
              tertiary={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Policy</span>
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex" />}>
                      <Select
                        value={t.approval}
                        disabled={t.status === "Disabled"}
                        onValueChange={(v) => {
                          if (!v || v === t.approval) return
                          const next = v as ToolApproval
                          onPatch(t.name, { approval: next })
                          toast.success(`Policy changed to ${next}`, {
                            description: approvalMeta[next].hint,
                          })
                        }}
                        items={toolApprovals.map((a) => ({
                          value: a,
                          label: a,
                        }))}
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
                    </TooltipTrigger>
                    {t.status === "Disabled" && (
                      <TooltipContent>
                        Enable the tool to change its policy
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              }
              secondary={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSchemaOpen(true)}
                >
                  <BracesIcon /> Edit schema
                </Button>
              }
              primary={
                t.status === "Disabled" ? (
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
                )
              }
            />

            <SchemaEditorSheet
              key={`${t.name}-${schemaOpen}`}
              open={schemaOpen}
              tool={t}
              onClose={() => setSchemaOpen(false)}
              onSave={(schema) => {
                onPatch(t.name, { inputSchema: schema })
                setSchemaOpen(false)
                toast.success("Schema saved", {
                  description: `${t.name} · ${Object.keys(schema.properties).length} field${Object.keys(schema.properties).length === 1 ? "" : "s"}, ${schema.required.length} required`,
                })
              }}
            />

            <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Disable{" "}
                    <code className="font-mono text-base">{t.name}</code>?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.agentIds.length === 0
                      ? "No agent currently has this tool, so nothing will break, but it stays hidden until re-enabled."
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
/* Schema editor                                                             */
/* ------------------------------------------------------------------------ */

function parseSchema(text: string): ToolInputSchema | string {
  try {
    const parsed = JSON.parse(text) as Partial<ToolInputSchema>
    if (
      !parsed ||
      parsed.type !== "object" ||
      typeof parsed.properties !== "object" ||
      parsed.properties === null
    )
      return 'Schema must be an object with "type": "object" and "properties".'
    const required = Array.isArray(parsed.required) ? parsed.required : []
    const unknown = required.filter(
      (r) => !(r in (parsed.properties as Record<string, unknown>))
    )
    if (unknown.length)
      return `Required field${unknown.length === 1 ? "" : "s"} not in properties: ${unknown.join(", ")}`
    return {
      type: "object",
      properties: parsed.properties as ToolInputSchema["properties"],
      required,
      additionalProperties: parsed.additionalProperties,
    }
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid JSON"
  }
}

function SchemaEditorSheet({
  open,
  tool,
  onClose,
  onSave,
}: {
  open: boolean
  tool: Tool
  onClose: () => void
  onSave: (schema: ToolInputSchema) => void
}) {
  const [text, setText] = React.useState(() =>
    JSON.stringify(tool.inputSchema, null, 2)
  )
  const parsed = parseSchema(text)
  const schema = typeof parsed === "string" ? null : parsed
  const error = typeof parsed === "string" ? parsed : null
  const dirty = text !== JSON.stringify(tool.inputSchema, null, 2)
  const fieldCount = schema ? Object.keys(schema.properties).length : 0

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Edit input schema</SheetTitle>
          <SheetDescription>
            JSON Schema for <span className="font-mono">{tool.name}</span>. The
            model reads property descriptions, so write them for the model.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-2">
          <Label htmlFor="schema-editor" className="sr-only">
            Input schema JSON
          </Label>
          <Textarea
            id="schema-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={22}
            className="min-h-96 flex-1 resize-y font-mono text-xs leading-relaxed"
          />
          <p
            className={cn(
              "text-xs",
              error ? "text-danger-text" : "text-muted-foreground"
            )}
          >
            {error ??
              `Valid: ${fieldCount} field${fieldCount === 1 ? "" : "s"}, ${schema?.required.length ?? 0} required`}
          </p>
        </SheetBody>
        <SheetFooterActions
          tertiary={
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty}
              onClick={() => setText(JSON.stringify(tool.inputSchema, null, 2))}
            >
              Reset
            </Button>
          }
          primary={
            <Button
              disabled={!dirty || schema === null}
              onClick={() => {
                if (schema) onSave(schema)
              }}
            >
              Save schema
            </Button>
          }
        />
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

function SideEffectSection({
  tool: t,
  onOpenTool,
}: {
  tool: Tool
  onOpenTool: (name: string) => void
}) {
  const sandboxed = toolIsSandboxed(t)
  const uncontained = t.outputSinks.filter(
    (s) => sinkMeta[s].hazardous && !sandboxed
  )
  const compensatingId = t.compensatingToolId
  const compensating = compensatingId ? getTool(compensatingId) : undefined
  const retryHint = t.idempotent
    ? "Retries and duplicate calls are safe."
    : t.risk === "Read"
      ? "Reads are retried freely."
      : `A retry repeats the side effect; the runtime caps retries at ${t.retries}.`
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <ShieldCheckIcon className="size-3.5 text-muted-foreground" />
        Side-effect safety
      </h3>
      {uncontained.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-danger-text" />
          <span>
            <span className="font-medium text-danger-text">
              {uncontained
                .map((s) => sinkMeta[s].label.toLowerCase())
                .join(" and ")}{" "}
              outside the sandbox.
            </span>{" "}
            Fetched markup or generated code reaches the agent loop unconfined;
            route this tool through the sandbox runner or treat its output as
            untrusted.
          </span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Fact label="Idempotent">
          <Flag on={t.idempotent} onLabel="Yes" offLabel="No" />
          <p className="mt-1 text-2xs leading-snug text-muted-foreground">
            {retryHint}
          </p>
        </Fact>
        <Fact label="Dry run">
          <Flag
            on={t.supportsDryRun}
            onLabel="Supported"
            offLabel="Not supported"
            warnOff={t.risk === "Destructive"}
          />
          {t.risk === "Destructive" && !t.supportsDryRun && (
            <p className="mt-1 text-2xs leading-snug text-warning-text">
              Destructive calls cannot be previewed before approval.
            </p>
          )}
        </Fact>
        <Fact label="Transaction limit">
          {t.maxTransactionUsd !== undefined ? (
            <span className="tabular-nums">
              {formatCurrency(t.maxTransactionUsd)} / call
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Fact>
        <Fact label="Compensating tool">
          {compensatingId ? (
            <button
              type="button"
              onClick={() => onOpenTool(compensatingId)}
              className="inline-flex max-w-full items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
              title={
                compensatingId === t.name
                  ? "Reversible through the same tool"
                  : compensating?.description
              }
            >
              <Undo2Icon className="size-3 shrink-0" aria-hidden />
              <span className="truncate">
                {compensatingId === t.name
                  ? "self (reverse call)"
                  : compensatingId}
              </span>
            </button>
          ) : (
            <span className="text-muted-foreground">
              {t.risk === "Read" ? "Not needed" : "None, irreversible"}
            </span>
          )}
        </Fact>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Eyebrow as="span">Output sinks</Eyebrow>
        {t.outputSinks.map((s) => (
          <SinkChip key={s} sink={s} warn={uncontained.includes(s)} />
        ))}
        {sandboxed && t.outputSinks.some((s) => sinkMeta[s].hazardous) && (
          <span className="text-2xs text-muted-foreground">
            · contained in the sandbox
          </span>
        )}
      </div>
    </section>
  )
}

function IdentitySection({ tool: t }: { tool: Tool }) {
  const id = t.identity
  const meta = identityModeMeta[id.mode]
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Identity &amp; delegation</h3>
      <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <IdentityModeBadge mode={id.mode} />
          <span className="text-xs text-muted-foreground">{meta.hint}</span>
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-xs text-muted-foreground">Audience</dt>
          <dd className="font-mono text-xs">
            {id.audience ?? (
              <span className="font-sans text-muted-foreground">
                {id.mode === "service"
                  ? "Internal, no token exchange"
                  : "Not pinned"}
              </span>
            )}
          </dd>
          <dt className="text-xs text-muted-foreground">Scopes</dt>
          <dd className="flex flex-wrap gap-1">
            {id.scopes.length === 0 ? (
              <span className="text-xs text-muted-foreground">None</span>
            ) : (
              id.scopes.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="h-5 px-1.5 font-mono text-2xs text-muted-foreground"
                >
                  {s}
                </Badge>
              ))
            )}
          </dd>
          <dt className="text-xs text-muted-foreground">Token TTL</dt>
          <dd className="text-xs tabular-nums">
            {id.tokenTtlMin} min
            {id.mode === "delegated" && id.tokenTtlMin > 15 && (
              <span className="ml-1.5 text-warning-text">
                (long for a delegated write)
              </span>
            )}
          </dd>
        </dl>
      </div>
    </section>
  )
}

function Flag({
  on,
  onLabel,
  offLabel,
  warnOff,
}: {
  on: boolean
  onLabel: string
  offLabel: string
  warnOff?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        on
          ? "text-success-text"
          : warnOff
            ? "text-warning-text"
            : "text-muted-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          on ? "bg-success" : warnOff ? "bg-warning" : "bg-muted-foreground/40"
        )}
      />
      {on ? onLabel : offLabel}
    </span>
  )
}
