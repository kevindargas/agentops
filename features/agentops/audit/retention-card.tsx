"use client"

import { cn } from "cn"
import {
  ArchiveIcon,
  CalendarRangeIcon,
  LockIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { RecordLink } from "@/components/shared/record-link"
import { toneClasses } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auditRetention, type AuditEvent } from "@/lib/data/audit"
import { formatDateTime, timeAgo } from "@/lib/format"

export function RetentionCard({
  events,
  chain,
  onOpen,
  action,
}: {
  events: AuditEvent[]
  chain: { ok: boolean; brokenAt?: string }
  onOpen: (id: string) => void
  /** Slot for the "Verify chain" button. */
  action?: React.ReactNode
}) {
  const r = auditRetention
  const first = events[0]
  const last = events[events.length - 1]
  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ArchiveIcon className="size-4 text-muted-foreground" />
          Retention &amp; integrity
          {action && <span className="ml-auto">{action}</span>}
        </CardTitle>
        <CardDescription className="text-xs">
          Where the trail lives, how long it is kept and whether anyone has
          touched it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
            chain.ok
              ? "border-success/25 bg-success/5"
              : "border-destructive/25 bg-destructive/5"
          )}
        >
          {chain.ok ? (
            <ShieldCheckIcon
              className={cn("mt-0.5 size-4 shrink-0", toneClasses.success.text)}
            />
          ) : (
            <ShieldAlertIcon
              className={cn("mt-0.5 size-4 shrink-0", toneClasses.danger.text)}
            />
          )}
          <div className="min-w-0 leading-snug">
            <p className="font-medium">
              {chain.ok
                ? `Hash chain intact across ${events.length} records`
                : `Chain broken at ${chain.brokenAt}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Last scheduled check {timeAgo(r.lastIntegrityCheck)} ·{" "}
              {formatDateTime(r.lastIntegrityCheck)} UTC
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          <Fact
            icon={<CalendarRangeIcon />}
            label="Retention"
            value={`${r.retentionDays} days`}
            hint="then archived, never purged under hold"
          />
          <Fact
            icon={<ArchiveIcon />}
            label="Storage"
            value={r.storage}
            hint={r.immutable ? "append-only · immutable" : "mutable"}
          />
          <Fact
            icon={<LockIcon />}
            label="Legal hold"
            value={`${r.legalHold.length} records`}
            hint={
              <span className="flex flex-wrap gap-x-1.5">
                {r.legalHold.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpen(id)}
                    className="font-mono hover:underline"
                  >
                    {id}
                  </button>
                ))}
              </span>
            }
          />
          <Fact
            icon={<ShieldCheckIcon />}
            label="Window"
            value={
              first && last
                ? `${formatDateTime(first.at)} → ${formatDateTime(last.at)}`
                : "n/a"
            }
            hint={
              first ? (
                <span>
                  genesis <RecordLink number={first.id} muted />
                </span>
              ) : undefined
            }
          />
        </dl>

        <div className="flex flex-wrap gap-1.5">
          {["SOC 2 CC7.2", "ISO 27001 A.8.15", "EU AI Act Art. 12"].map(
            (tag) => (
              <Badge key={tag} variant="secondary" className="text-2xs">
                {tag}
              </Badge>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Fact({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 font-medium text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">
        {value}
      </dd>
      {hint && (
        <dd className="mt-0.5 text-2xs leading-snug text-muted-foreground">
          {hint}
        </dd>
      )}
    </div>
  )
}
