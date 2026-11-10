"use client"

import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  BotIcon,
  ExternalLinkIcon,
  LinkIcon,
  LockIcon,
  RocketIcon,
  RouteIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  auditDigest,
  auditRetention,
  auditSourceLabel,
  type AuditEvent,
} from "@/lib/data/audit"
import { formatDateTime, timeAgo } from "@/lib/format"
import { sessionAuditIds } from "./audit-store"
import {
  ActionBadge,
  ActorChip,
  ActorKindBadge,
  HashChip,
  SourceChip,
  targetKindLabel,
} from "./shared"

export function AuditEventSheet({
  event: e,
  previous,
  onClose,
  onOpen,
}: {
  event: AuditEvent | null
  /** The record immediately before `event` in the chain, for link verification. */
  previous: AuditEvent | null
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const linkOk =
    e !== null &&
    (previous ? e.prevHash === previous.hash : /^0+$/.test(e.prevHash)) &&
    e.hash === auditDigest(e.prevHash, e)
  const onHold = e ? auditRetention.legalHold.includes(e.id) : false
  const fromSession = e ? sessionAuditIds.has(e.id) : false

  return (
    <Sheet open={e !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {e && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ActionBadge action={e.action} size="default" />
                <ActorKindBadge kind={e.actor.kind} />
                {fromSession && <StateBadge state="This session" size="sm" />}
                <SourceChip source={e.source} className="ml-auto" />
              </div>
              <SheetTitle className="flex items-center gap-2 font-mono text-lg leading-tight">
                {e.id}
                <CopyButton value={e.id} label="Copy event id" />
                {onHold && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-auto h-5 gap-1 px-1.5 text-2xs",
                      toneClasses.warning.badge
                    )}
                  >
                    <LockIcon /> Legal hold
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed text-foreground/80">
                {e.summary}
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                <section>
                  <DetailList
                    variant="rows"
                    dense
                    items={[
                      {
                        label: "When",
                        value: (
                          <span className="tabular-nums">
                            {formatDateTime(e.at)}
                            <span className="ml-1.5 text-muted-foreground">
                              · {timeAgo(e.at)}
                            </span>
                          </span>
                        ),
                        hint: e.at,
                      },
                      {
                        label: "Actor",
                        value: <ActorChip actor={e.actor} size="sm" />,
                        hint: <span className="font-mono">{e.actor.id}</span>,
                      },
                      {
                        label: "Action",
                        value: e.action,
                        mono: true,
                        copyable: true,
                      },
                      {
                        label: "Target",
                        value: (
                          <Link
                            href={e.target.href}
                            className="inline-flex items-center gap-1.5 font-medium hover:underline"
                          >
                            {e.target.label}
                            <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                          </Link>
                        ),
                        hint: (
                          <span>
                            {targetKindLabel(e.target.kind)} ·{" "}
                            <span className="font-mono">{e.target.id}</span>
                          </span>
                        ),
                      },
                      {
                        label: "Source",
                        value: auditSourceLabel[e.source],
                      },
                    ]}
                  />
                </section>

                {(e.before !== undefined || e.after !== undefined) && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Change</h3>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                      <DiffBlock
                        label="Before"
                        value={e.before}
                        kind="before"
                      />
                      <ArrowRightIcon className="hidden size-4 self-center text-muted-foreground sm:block" />
                      <DiffBlock label="After" value={e.after} kind="after" />
                    </div>
                  </section>
                )}

                <ContextChips event={e} />

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Integrity</h3>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        linkOk
                          ? toneClasses.success.text
                          : toneClasses.danger.text
                      )}
                    >
                      {linkOk ? (
                        <ShieldCheckIcon className="size-3.5" />
                      ) : (
                        <ShieldAlertIcon className="size-3.5" />
                      )}
                      {linkOk ? "Chain link verified" : "Chain link broken"}
                    </span>
                  </div>
                  <div className="divide-y rounded-lg border bg-muted/30 text-xs">
                    <HashRow label="hash" value={e.hash} />
                    <HashRow
                      label="prevHash"
                      value={e.prevHash}
                      action={
                        previous ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onOpen(previous.id)}
                          >
                            <LinkIcon /> {previous.id}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">
                            genesis record
                          </span>
                        )
                      }
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Digest over prevHash · id · timestamp · action · target ·
                    summary. Editing any field or removing a record changes
                    every hash after it.
                    {fromSession &&
                      " This record was appended in the current session and is lost on reload."}
                  </p>
                </section>
              </div>
            </SheetBody>
            <SheetFooterActions />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DiffBlock({
  label,
  value,
  kind,
}: {
  label: string
  value?: string
  kind: "before" | "after"
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2",
        kind === "before"
          ? "border-destructive/25 bg-destructive/5"
          : "border-success/25 bg-success/5"
      )}
    >
      <Eyebrow
        className={
          kind === "before" ? toneClasses.danger.text : toneClasses.success.text
        }
      >
        {kind === "before" ? "−" : "+"} {label}
      </Eyebrow>
      <pre className="mt-1 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
        {value ?? <span className="text-muted-foreground">n/a</span>}
      </pre>
    </div>
  )
}

function HashRow({
  label,
  value,
  action,
}: {
  label: string
  value: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="w-16 font-medium text-muted-foreground">{label}</span>
      <HashChip value={value} short={false} />
      <CopyButton value={value} label={`Copy ${label}`} />
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
}

function ContextChips({ event: e }: { event: AuditEvent }) {
  const context = e.context
  const chips: {
    label: string
    value: string
    href?: string
    icon?: React.ReactNode
  }[] = []
  if (context.agentId)
    chips.push({
      label: "Agent",
      value: context.agentId,
      href: `/agentops/agents/${context.agentId}`,
      icon: <BotIcon />,
    })
  if (context.traceId)
    chips.push({
      label: "Trace",
      value: context.traceId,
      href: `/agentops/traces/${context.traceId}`,
      icon: <RouteIcon />,
    })
  if (context.releaseId)
    chips.push({
      label: "Release",
      value: context.releaseId,
      href: `/agentops/deployments/${context.releaseId}`,
      icon: <RocketIcon />,
    })
  if (context.promptVersion)
    chips.push({
      label: "Prompt version",
      value: context.promptVersion,
      // Prompt events already carry the exact prompt page as their target.
      href:
        e.target.kind === "prompt-version"
          ? e.target.href
          : "/agentops/prompts",
      icon: <ScrollTextIcon />,
    })
  if (context.modelId) chips.push({ label: "Model", value: context.modelId })
  if (context.policyVersion)
    chips.push({ label: "Policy version", value: context.policyVersion })
  if (context.approvalId)
    chips.push({
      label: "Approval",
      value: context.approvalId,
      href:
        e.source === "release"
          ? "/agentops/deployments?tab=approvals"
          : undefined,
    })

  if (chips.length === 0 && !context.reason) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Context</h3>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const body = (
              <>
                {c.icon}
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-mono">{c.value}</span>
              </>
            )
            return c.href ? (
              <Badge
                key={c.label}
                variant="outline"
                className="h-6 gap-1.5 px-2 text-2xs"
                render={<Link href={c.href} />}
              >
                {body}
              </Badge>
            ) : (
              <Badge
                key={c.label}
                variant="outline"
                className="h-6 gap-1.5 px-2 text-2xs"
              >
                {body}
              </Badge>
            )
          })}
        </div>
      )}
      {context.reason && (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Reason · </span>
          {context.reason}
        </p>
      )}
    </section>
  )
}
