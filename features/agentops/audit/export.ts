import type { AuditEvent } from "@/lib/data/audit"

/** Stable, pretty-printed JSON of the given events (ascending by time). */
export function auditToJson(events: AuditEvent[]) {
  return JSON.stringify(events, null, 2)
}

const CSV_COLUMNS = [
  "id",
  "at",
  "actor_kind",
  "actor_id",
  "actor_name",
  "action",
  "source",
  "target_kind",
  "target_id",
  "target_label",
  "target_href",
  "summary",
  "before",
  "after",
  "agent_id",
  "trace_id",
  "prompt_version",
  "model_id",
  "policy_version",
  "approval_id",
  "release_id",
  "reason",
  "hash",
  "prev_hash",
] as const

function csvCell(v: string | undefined) {
  if (v === undefined || v === "") return ""
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** RFC 4180 CSV with a fixed column order so exports diff cleanly. */
export function auditToCsv(events: AuditEvent[]) {
  const rows = events.map((e) =>
    [
      e.id,
      e.at,
      e.actor.kind,
      e.actor.id,
      e.actor.name,
      e.action,
      e.source,
      e.target.kind,
      e.target.id,
      e.target.label,
      e.target.href,
      e.summary,
      e.before,
      e.after,
      e.context.agentId,
      e.context.traceId,
      e.context.promptVersion,
      e.context.modelId,
      e.context.policyVersion,
      e.context.approvalId,
      e.context.releaseId,
      e.context.reason,
      e.hash,
      e.prevHash,
    ]
      .map(csvCell)
      .join(",")
  )
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n"
}

/** Client-side blob download. No-op outside the browser. */
export function downloadText(filename: string, content: string, mime: string) {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
