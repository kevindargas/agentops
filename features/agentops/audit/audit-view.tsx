"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  DownloadIcon,
  FileJsonIcon,
  ShieldCheckIcon,
  TableIcon,
} from "lucide-react"
import { toast } from "sonner"

import { setQueryParams } from "@/hooks/use-query-param"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  auditEventsSince,
  auditRetention,
  verifyAuditChain,
  type AuditEvent,
} from "@/lib/data/audit"
import { timeAgo } from "@/lib/format"
import { AuditEventSheet } from "./audit-event-sheet"
import { auditStore, sessionAuditIds } from "./audit-store"
import { AuditTable } from "./audit-table"
import { auditToCsv, auditToJson, downloadText } from "./export"
import { RetentionCard } from "./retention-card"

type Range = "1" | "7" | "30" | "all"
const ranges: { value: Range; label: string }[] = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "Full retention window" },
]

function inRange(events: AuditEvent[], range: Range): AuditEvent[] {
  if (range === "all") return events
  return auditEventsSince(Number(range), events)
}

/**
 * Audit log page body. Reads the shared client audit store, so records that
 * Guardrails, Evals and Deployments append in this session appear here with a
 * valid chain link. The open record is driven by `?event=<id>`; `?q=` seeds
 * the search box (release toasts link here with the release id).
 */
export function AuditView({
  initialSource,
  initialQuery,
}: {
  /** Pre-select a source facet, e.g. from `?source=release`. */
  initialSource?: string
  /** Seeds the table search box, e.g. with a release id. */
  initialQuery?: string
}) {
  const params = useSearchParams()
  const events = auditStore.use()
  const eventId = params.get("event")
  const rangeParam = params.get("range")
  const range: Range =
    rangeParam === "1" || rangeParam === "7" || rangeParam === "all"
      ? rangeParam
      : "30"

  const openEvent = React.useCallback(
    (id: string | null) => setQueryParams({ event: id }),
    []
  )

  const chain = React.useMemo(() => verifyAuditChain(events), [events])
  const visible = React.useMemo(() => inRange(events, range), [events, range])
  const last30 = auditEventsSince(30, events)
  const actors = new Set(last30.map((e) => e.actor.id)).size
  const people = new Set(
    last30.filter((e) => e.actor.kind === "user").map((e) => e.actor.id)
  ).size
  const sessionCount = events.filter((e) => sessionAuditIds.has(e.id)).length

  const index = eventId ? events.findIndex((e) => e.id === eventId) : -1
  const open = index >= 0 ? events[index] : null
  const previous = index > 0 ? events[index - 1] : null

  function exportAs(kind: "json" | "csv") {
    const label = range === "all" ? "all" : `${range}d`
    const file = `agentops-audit-${label}.${kind}`
    downloadText(
      file,
      kind === "json" ? auditToJson(visible) : auditToCsv(visible),
      kind === "json" ? "application/json" : "text/csv"
    )
    toast.success(`Exported ${visible.length} events`, {
      description: `${file} · hashes included so the file can be re-verified`,
    })
  }

  function verify() {
    const result = verifyAuditChain(events)
    if (result.ok)
      toast.success("Chain verified", {
        description: `${events.length} records re-hashed from genesis; every prevHash matches.`,
        icon: <ShieldCheckIcon className="size-4" />,
      })
    else {
      const brokenAt = result.brokenAt
      toast.error("Chain broken", {
        description: `Digest mismatch at ${brokenAt}. Records after it cannot be trusted.`,
        action: brokenAt
          ? { label: "Open", onClick: () => openEvent(brokenAt) }
          : undefined,
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StatGrid columns={4}>
        <StatCard
          label="Events · 30d"
          value={last30.length}
          hint={`${events.length} in the retention window${sessionCount ? ` · ${sessionCount} appended this session` : ""}`}
        />
        <StatCard
          label="Actors · 30d"
          value={actors}
          hint={`${people} people · ${actors - people} agents and system`}
        />
        <StatCard
          label="Chain integrity"
          value={
            <span
              className={chain.ok ? "text-success-text" : "text-danger-text"}
            >
              {chain.ok ? "Verified" : "Broken"}
            </span>
          }
          hint={`Last check ${timeAgo(auditRetention.lastIntegrityCheck)}`}
        />
        <StatCard
          label="Retention"
          value={auditRetention.retentionDays}
          unit="days"
          hint={`${auditRetention.storage} · ${auditRetention.legalHold.length} on legal hold`}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <AuditTable
            events={visible}
            onOpen={openEvent}
            initialFacets={
              initialSource ? { source: [initialSource] } : undefined
            }
            initialSearch={initialQuery}
            toolbar={
              <>
                <Select
                  value={range}
                  onValueChange={(v) =>
                    setQueryParams({
                      range: v === "30" || !v ? null : String(v),
                    })
                  }
                  items={ranges}
                >
                  <SelectTrigger size="sm" className="w-44" aria-label="Range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ranges.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAs("json")}
                  title="Download the events in the current range as JSON"
                >
                  <FileJsonIcon /> JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAs("csv")}
                  title="Download the events in the current range as CSV"
                >
                  <TableIcon /> CSV
                </Button>
              </>
            }
          />
        </div>
        <div className="flex flex-col gap-4">
          <RetentionCard
            events={events}
            chain={chain}
            onOpen={openEvent}
            action={
              <Button variant="outline" size="xs" onClick={verify}>
                <ShieldCheckIcon /> Verify chain
              </Button>
            }
          />
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            <DownloadIcon className="mr-1 inline size-3" />
            Exports carry <span className="font-mono">hash</span> and{" "}
            <span className="font-mono">prevHash</span>, so an auditor can
            re-run the digest offline without access to this console.
          </p>
        </div>
      </div>

      <AuditEventSheet
        event={open}
        previous={previous}
        onClose={() => openEvent(null)}
        onOpen={openEvent}
      />
    </div>
  )
}
