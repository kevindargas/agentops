import {
  AUDIT_GENESIS_HASH,
  auditDigest,
  auditEvents,
  type AuditEvent,
  type AuditSource,
  type AuditTarget,
} from "@/lib/data/audit"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { createListStore } from "@/lib/store"

/**
 * Client-side audit log. Seeded from `auditEvents` and shared by every Govern
 * page, so an action taken on Guardrails, Evals or Deployments shows up on the
 * Audit Log in the same session. Appended records are hash-chained with the
 * same `auditDigest` the seed uses, so `verifyAuditChain` stays green over the
 * whole list. Not persisted: a reload returns to the seed.
 */
export const auditStore = createListStore(auditEvents, (e) => e.id)

/** Ids of records appended in this session (not part of the seed). */
export const sessionAuditIds = new Set<string>()

export interface AuditDraft {
  action: string
  source: AuditSource
  target: AuditTarget
  summary: string
  before?: string
  after?: string
  context?: AuditEvent["context"]
  /** Defaults to the signed-in sample user. */
  actor?: AuditEvent["actor"]
}

/**
 * Append one record to the client audit log and return it. The id continues
 * the seed sequence and the hash chains onto the current last record.
 */
export function recordAudit(draft: AuditDraft): AuditEvent {
  const items = auditStore.get()
  const last = items[items.length - 1]
  const id = `aud-${String(items.length + 1).padStart(6, "0")}`
  const base = {
    id,
    at: clock().toISOString(),
    actor: draft.actor ?? {
      kind: "user" as const,
      id: currentUser.id,
      name: currentUser.name,
    },
    action: draft.action,
    source: draft.source,
    target: draft.target,
    summary: draft.summary,
    before: draft.before,
    after: draft.after,
    context: draft.context ?? {},
  }
  const prevHash = last?.hash ?? AUDIT_GENESIS_HASH
  const event: AuditEvent = {
    ...base,
    prevHash,
    hash: auditDigest(prevHash, base),
  }
  auditStore.add(event, "end")
  sessionAuditIds.add(id)
  return event
}

/** Audit page link filtered to one source and search term. */
export function auditHref(source: AuditSource, q?: string) {
  const sp = new URLSearchParams({ source })
  if (q) sp.set("q", q)
  return `/agentops/audit?${sp}`
}
