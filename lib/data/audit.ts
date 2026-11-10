/**
 * Append-only, tamper-evident audit log for the AgentOps control plane.
 *
 * Most events are *derived* from the version history that already lives in
 * the other data modules (prompt versions, guardrail versions, release
 * activity, review verdicts, tool permissions, budgets, memory stores, API
 * keys, readiness snapshots) so the trail agrees with every record page.
 * The remainder is seeded with `createRng` so the chain stays deterministic
 * between server and client renders.
 */

import { agentTraces, deployedAgents, reviewItems } from "./agentops"
import { budgets } from "./costs"
import { releaseApprovals, releases } from "./deployments"
import { guardrails } from "./guardrails"
import { memoryStores } from "./knowledge"
import { prompts } from "./prompts"
import { apiKeys } from "./providers"
import { sampleAssessment, sampleSnapshots } from "./readiness"
import { chance, createRng, hoursAgo, int, NOW, pad, pick } from "./seed"
import { mcpServers, toolPermissions, tools } from "./tools"
import { getUser } from "./users"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type AuditSource =
  | "prompt"
  | "guardrail"
  | "release"
  | "review"
  | "tool-permission"
  | "mcp-server"
  | "budget"
  | "memory"
  | "api-key"
  | "agent-config"
  | "readiness"

export type AuditActorKind = "user" | "agent" | "system"

export interface AuditActor {
  kind: AuditActorKind
  id: string
  name: string
}

export interface AuditTarget {
  /** Record kind, e.g. "prompt-version", "release", "trace". */
  kind: string
  id: string
  label: string
  /** Route of the existing record page or sheet. */
  href: string
}

export interface AuditContext {
  agentId?: string
  traceId?: string
  promptVersion?: string
  modelId?: string
  policyVersion?: string
  approvalId?: string
  releaseId?: string
  reason?: string
}

export interface AuditEvent {
  /** `aud-000123`, assigned in chronological order. */
  id: string
  at: string
  actor: AuditActor
  /** Dotted verb, e.g. `prompt.version.promoted`, `release.rolled_back`. */
  action: string
  source: AuditSource
  target: AuditTarget
  summary: string
  before?: string
  after?: string
  context: AuditContext
  /** Hash of this record chained onto `prevHash`. */
  hash: string
  prevHash: string
}

export interface AuditRetention {
  retentionDays: number
  immutable: boolean
  /** Event ids pinned beyond the retention window. */
  legalHold: string[]
  storage: string
  lastIntegrityCheck: string
}

export const auditSources: AuditSource[] = [
  "prompt",
  "guardrail",
  "release",
  "review",
  "tool-permission",
  "mcp-server",
  "budget",
  "memory",
  "api-key",
  "agent-config",
  "readiness",
]

export const auditSourceLabel: Record<AuditSource, string> = {
  prompt: "Prompts",
  guardrail: "Guardrails",
  release: "Releases",
  review: "Reviews",
  "tool-permission": "Tool permissions",
  "mcp-server": "MCP servers",
  budget: "Budgets",
  memory: "Memory",
  "api-key": "API keys",
  "agent-config": "Agent config",
  readiness: "Readiness",
}

export const auditActorKinds: AuditActorKind[] = ["user", "agent", "system"]

/** First segment of the action verb: `prompt`, `release`, `tool`… */
export function auditActionFamily(action: string) {
  return action.split(".")[0]
}

/* -------------------------------------------------------------------------- */
/* Hash chain                                                                  */
/* -------------------------------------------------------------------------- */

export const AUDIT_GENESIS_HASH = "0000000000000000"

function fnv1a(input: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function djb2(input: string) {
  let h = 5381
  for (let i = 0; i < input.length; i++)
    h = (Math.imul(h, 33) + input.charCodeAt(i)) >>> 0
  return h >>> 0
}

const hex8 = (n: number) => n.toString(16).padStart(8, "0")

/** 16-hex-char digest over the fields that make a record unique. */
export function auditDigest(
  prevHash: string,
  e: Pick<AuditEvent, "id" | "at" | "action" | "summary"> & {
    target: Pick<AuditTarget, "id">
  }
) {
  const payload = `${prevHash}${e.id}${e.at}${e.action}${e.target.id}${e.summary}`
  return hex8(fnv1a(payload)) + hex8(djb2(payload))
}

export function verifyAuditChain(events: AuditEvent[]): {
  ok: boolean
  brokenAt?: string
} {
  let prev = AUDIT_GENESIS_HASH
  for (const e of events) {
    if (e.prevHash !== prev || e.hash !== auditDigest(prev, e))
      return { ok: false, brokenAt: e.id }
    prev = e.hash
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

type Draft = Omit<AuditEvent, "id" | "hash" | "prevHash">

const SYSTEM: AuditActor = {
  kind: "system",
  id: "sys-control-plane",
  name: "Control plane",
}

function userActor(id: string | undefined, fallback = "u-001"): AuditActor {
  const u = getUser(id) ?? getUser(fallback)!
  return { kind: "user", id: u.id, name: u.name }
}

function agentActor(agentId: string): AuditActor {
  const a = deployedAgents.find((x) => x.id === agentId)
  return { kind: "agent", id: agentId, name: a?.name ?? agentId }
}

function agentName(agentId: string | undefined) {
  if (!agentId) return "fleet"
  return deployedAgents.find((a) => a.id === agentId)?.name ?? agentId
}

function shift(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

/* ---- Prompts -------------------------------------------------------------- */

function fromPrompts(): Draft[] {
  const rng = createRng(9101)
  const out: Draft[] = []
  for (const p of prompts) {
    const target = (v: { id: string; number: number }) => ({
      kind: "prompt-version",
      id: v.id,
      label: `${p.name} · v${v.number}`,
      href: `/agentops/prompts/${p.id}`,
    })
    const versions = [...p.versions].sort((a, b) => a.number - b.number)
    versions.forEach((v, i) => {
      const prev = versions[i - 1]
      out.push({
        at: v.createdAt,
        actor: userActor(v.authorId),
        action: "prompt.version.created",
        source: "prompt",
        target: target(v),
        summary: `Created v${v.number} of ${p.name}: ${v.changeNote}`,
        before: prev ? `v${prev.number} · ${prev.modelId}` : undefined,
        after: `v${v.number} · ${v.modelId}`,
        context: {
          agentId: p.agentId,
          promptVersion: v.id,
          modelId: v.modelId,
        },
      })
      if (v.label === "production") {
        out.push({
          at: shift(v.createdAt, int(rng, 3, 30)),
          actor: userActor(p.ownerId),
          action: "prompt.version.promoted",
          source: "prompt",
          target: target(v),
          summary: `Promoted v${v.number} of ${p.name} to production`,
          before: prev ? `production → v${prev.number}` : "no production label",
          after: `production → v${v.number}`,
          context: {
            agentId: p.agentId,
            promptVersion: v.id,
            modelId: v.modelId,
          },
        })
      } else if (v.review === "Rejected") {
        out.push({
          at: shift(v.createdAt, int(rng, 2, 20)),
          actor: userActor(pick(rng, ["u-001", "u-002", "u-004"])),
          action: "prompt.version.rejected",
          source: "prompt",
          target: target(v),
          summary: `Rejected v${v.number} of ${p.name} in review`,
          context: {
            agentId: p.agentId,
            promptVersion: v.id,
            reason: "Eval score below the promotion gate",
          },
        })
      }
    })
  }
  return out
}

/* ---- Guardrails ----------------------------------------------------------- */

function fromGuardrails(): Draft[] {
  const out: Draft[] = []
  for (const g of guardrails) {
    const target = {
      kind: "guardrail",
      id: g.id,
      label: g.name,
      href: `/agentops/guardrails?policy=${g.id}`,
    }
    const versions = [...g.versions].sort((a, b) =>
      a.changed.localeCompare(b.changed)
    )
    versions.forEach((v, i) => {
      const first = i === 0
      const threshold =
        !first &&
        g.threshold &&
        /threshold|raised|lowered|limit/i.test(v.summary)
      const action = first
        ? "guardrail.policy.created"
        : threshold
          ? "guardrail.threshold.changed"
          : "guardrail.policy.updated"
      const t = g.threshold
      out.push({
        at: v.changed,
        actor: userActor(v.authorId),
        action,
        source: "guardrail",
        target,
        summary: `${g.name} ${v.version}: ${v.summary}`,
        before:
          threshold && t
            ? `${t.label} ${Math.max(t.min, t.value - t.step * 2)}${t.unit ?? ""}`
            : undefined,
        after:
          threshold && t ? `${t.label} ${t.value}${t.unit ?? ""}` : undefined,
        context: {
          policyVersion: v.version,
          modelId: g.modelId,
          agentId: g.scope === "all" ? undefined : g.scope[0],
        },
      })
    })
    if (g.status === "Disabled") {
      out.push({
        at: shift(g.updated, 1),
        actor: userActor(g.ownerId),
        action: "guardrail.policy.disabled",
        source: "guardrail",
        target,
        summary: `Disabled ${g.name} (${g.mode})`,
        before: "Active",
        after: "Disabled",
        context: {
          policyVersion: versions.at(-1)?.version,
          reason: "False-positive rate above tolerance",
        },
      })
    }
  }
  return out
}

/* ---- Releases + agent config --------------------------------------------- */

const releaseAction: Record<string, string> = {
  created: "release.created",
  eval: "release.eval_gate.passed",
  approval: "release.approved",
  deploy: "release.deployed",
  advance: "release.canary.advanced",
  promote: "release.promoted",
  rollback: "release.rolled_back",
  fail: "release.failed",
  note: "release.annotated",
}

function fromReleases(): Draft[] {
  const out: Draft[] = []
  for (const r of releases) {
    const approval = releaseApprovals.find((a) => a.releaseId === r.id)
    const target = {
      kind: "release",
      id: r.id,
      label: `${agentName(r.agentId)} ${r.version}`,
      href: `/agentops/deployments/${r.id}`,
    }
    const ctx: AuditContext = {
      agentId: r.agentId,
      releaseId: r.id,
      approvalId: approval?.id,
    }
    for (const ev of r.activity) {
      const action = releaseAction[ev.kind] ?? "release.annotated"
      const isVersionMove = ev.kind === "promote" || ev.kind === "rollback"
      out.push({
        at: ev.at,
        actor: ev.actorId ? userActor(ev.actorId) : SYSTEM,
        action,
        source: "release",
        target,
        summary: `${target.label}: ${ev.message}`,
        before: isVersionMove
          ? ev.kind === "promote"
            ? r.previousVersion
            : r.version
          : undefined,
        after: isVersionMove
          ? ev.kind === "promote"
            ? r.version
            : r.rollbackTarget
          : undefined,
        context: {
          ...ctx,
          reason:
            ev.kind === "rollback" || ev.kind === "fail"
              ? ev.message
              : undefined,
        },
      })
    }
    for (const a of r.approvers) {
      if (a.status === "rejected" || a.status === "changes requested") {
        out.push({
          at: a.at ?? shift(r.createdAt, 6),
          actor: userActor(a.userId),
          action:
            a.status === "rejected"
              ? "release.rejected"
              : "release.changes_requested",
          source: "release",
          target,
          summary: `${a.role} ${a.status} on ${target.label}`,
          context: ctx,
        })
      }
    }
    // Model and parameter changes shipped by the release are the agent-config trail.
    if (r.deployedAt) {
      for (const c of r.changes) {
        if (c.kind !== "model" && c.kind !== "params") continue
        out.push({
          at: shift(r.deployedAt, 0.05),
          actor: userActor(r.deployedById),
          action:
            c.kind === "model"
              ? "agent.config.model_changed"
              : "agent.config.params_changed",
          source: "agent-config",
          target: {
            kind: "agent",
            id: r.agentId,
            label: agentName(r.agentId),
            href: `/agentops/agents/${r.agentId}`,
          },
          summary: `${agentName(r.agentId)} ${c.field}: ${c.before} → ${c.after}`,
          before: c.before,
          after: c.after,
          context: {
            ...ctx,
            modelId: c.kind === "model" ? c.after : undefined,
          },
        })
      }
    }
  }
  return out
}

/* ---- Reviews -------------------------------------------------------------- */

function fromReviews(): Draft[] {
  const rng = createRng(9104)
  const out: Draft[] = []
  for (const r of reviewItems) {
    if (r.status === "Pending" || !r.reviewerId) continue
    const action =
      r.status === "Approved"
        ? "review.approved"
        : r.status === "Flagged"
          ? "review.flagged"
          : "review.corrected"
    out.push({
      at: shift(r.created, int(rng, 1, 18)),
      actor: userActor(r.reviewerId),
      action,
      source: "review",
      target: {
        kind: "trace",
        id: r.traceId,
        label: r.traceId,
        href: `/agentops/traces/${r.traceId}`,
      },
      summary: `${r.status} ${r.id} (${r.reason}) on ${agentName(r.agentId)}`,
      before: r.status === "Corrected" ? "Agent answer as served" : undefined,
      after: r.status === "Corrected" ? r.correction : undefined,
      context: {
        agentId: r.agentId,
        traceId: r.traceId,
        reason: r.note ?? r.reason,
      },
    })
  }
  return out
}

/* ---- Tools, permissions, MCP servers ------------------------------------- */

function fromTools(): Draft[] {
  const rng = createRng(9105)
  const out: Draft[] = []
  for (const t of tools) {
    if (t.status === "Deprecated") {
      out.push({
        at: hoursAgo(int(rng, 24 * 20, 24 * 60)),
        actor: userActor(t.ownerId),
        action: "tool.deprecated",
        source: "tool-permission",
        target: {
          kind: "tool",
          id: t.name,
          label: t.name,
          href: `/agentops/tools?tool=${t.name}`,
        },
        summary: `Deprecated ${t.name}${t.replacedBy ? ` in favour of ${t.replacedBy}` : ""}`,
        before: "Active",
        after: "Deprecated",
        context: {
          reason: t.replacedBy ? `Superseded by ${t.replacedBy}` : undefined,
        },
      })
    }
    if (t.status === "Disabled") {
      out.push({
        at: hoursAgo(int(rng, 24 * 3, 24 * 40)),
        actor: userActor(t.ownerId),
        action: "tool.disabled",
        source: "tool-permission",
        target: {
          kind: "tool",
          id: t.name,
          label: t.name,
          href: `/agentops/tools?tool=${t.name}`,
        },
        summary: `Disabled ${t.name}; calls now fail closed for ${t.agentIds.length} agents`,
        before: "Active",
        after: "Disabled",
        context: { reason: "Error rate above budget" },
      })
    }
  }
  // Non-default permission decisions are the result of an explicit change.
  const changed = toolPermissions.filter(
    (p) =>
      (p.risk === "Destructive" && p.decision !== "deny") ||
      (p.risk === "Write" && p.decision !== "approval") ||
      (p.risk === "Read" && p.decision !== "allow")
  )
  for (const p of changed.slice(0, 10)) {
    const granted = p.decision === "allow"
    const prevDecision =
      p.risk === "Destructive"
        ? "deny"
        : p.risk === "Write"
          ? "approval"
          : "allow"
    out.push({
      at: hoursAgo(int(rng, 12, 24 * 45)),
      actor: userActor(pick(rng, ["u-001", "u-004", "u-006"])),
      action: granted
        ? "tool.permission.granted"
        : p.decision === "deny"
          ? "tool.permission.revoked"
          : "tool.permission.changed",
      source: "tool-permission",
      target: {
        kind: "permission",
        id: `${p.agentId}:${p.risk.toLowerCase()}`,
        label: `${agentName(p.agentId)} · ${p.risk} tools`,
        href: `/agentops/tools?tab=permissions`,
      },
      summary: `${agentName(p.agentId)} ${p.risk.toLowerCase()} tools: ${prevDecision} → ${p.decision}`,
      before: prevDecision,
      after: p.decision,
      context: { agentId: p.agentId },
    })
  }
  for (const s of mcpServers) {
    const target = {
      kind: "mcp-server",
      id: s.id,
      label: s.name,
      href: `/agentops/tools?server=${s.id}`,
    }
    out.push({
      at: hoursAgo(int(rng, 24 * 30, 24 * 120)),
      actor: userActor(s.ownerId),
      action: "mcp_server.registered",
      source: "mcp-server",
      target,
      summary: `Registered MCP server ${s.name} (${s.transport}, ${s.auth}) exposing ${s.toolNames.length} tools`,
      context: {},
    })
    if (s.status !== "Connected") {
      out.push({
        at: s.lastHealthCheck,
        actor: SYSTEM,
        action:
          s.status === "Disconnected"
            ? "mcp_server.disconnected"
            : "mcp_server.degraded",
        source: "mcp-server",
        target,
        summary: `${s.name} reported ${s.status.toLowerCase()}${s.note ? `: ${s.note}` : ""}`,
        before: "Connected",
        after: s.status,
        context: { reason: s.note },
      })
    }
  }
  return out
}

/* ---- Budgets -------------------------------------------------------------- */

function fromBudgets(): Draft[] {
  const rng = createRng(9106)
  const out: Draft[] = []
  for (const b of budgets) {
    const target = {
      kind: "budget",
      id: b.id,
      label: b.name,
      href: `/agentops/costs?tab=budgets&budget=${b.id}`,
    }
    const agentId = b.scope.kind === "agent" ? b.scope.id : undefined
    const prevLimit = Math.round(b.limit * pick(rng, [0.8, 0.9, 1.25]))
    out.push({
      at: b.updated,
      actor: userActor(b.ownerId),
      action: "budget.limit.changed",
      source: "budget",
      target,
      summary: `${b.name} ${b.period} limit $${prevLimit.toLocaleString("en-US")} → $${b.limit.toLocaleString("en-US")}`,
      before: `$${prevLimit.toLocaleString("en-US")} / ${b.period}`,
      after: `$${b.limit.toLocaleString("en-US")} / ${b.period}`,
      context: { agentId },
    })
    if (b.status === "Exceeded") {
      const at = hoursAgo(int(rng, 2, 60))
      out.push({
        at,
        actor: SYSTEM,
        action: "budget.breached",
        source: "budget",
        target,
        summary: `${b.name} exceeded its ${b.period} limit ($${Math.round(b.spent).toLocaleString("en-US")} of $${b.limit.toLocaleString("en-US")})`,
        context: { agentId, reason: `On breach: ${b.onBreach}` },
      })
      out.push({
        at: shift(at, 0.02),
        actor: SYSTEM,
        action: "budget.action.triggered",
        source: "budget",
        target,
        summary: `Breach action "${b.onBreach}" applied to ${b.scope.label}`,
        after: b.onBreach,
        context: { agentId },
      })
    }
  }
  return out
}

/* ---- Memory --------------------------------------------------------------- */

function fromMemory(): Draft[] {
  const rng = createRng(9107)
  const out: Draft[] = []
  for (const m of memoryStores) {
    const target = {
      kind: "memory-store",
      id: m.id,
      label: m.name,
      href: `/agentops/knowledge?tab=memory`,
    }
    out.push({
      at: m.lastCompaction,
      actor: agentActor(m.agentId),
      action: "memory.compacted",
      source: "memory",
      target,
      summary: `${m.name} compacted ${m.records.toLocaleString("en-US")} records on ${m.backend}`,
      context: { agentId: m.agentId },
    })
    if (m.type === "user long-term" || m.type === "episodic") {
      const n = int(rng, 3, 48)
      out.push({
        at: hoursAgo(int(rng, 6, 24 * 25)),
        actor: userActor(pick(rng, ["u-002", "u-005", "u-011"])),
        action: "memory.user_deleted",
        source: "memory",
        target,
        summary: `Deleted ${n} user memories from ${m.name} on data-subject request`,
        before: `${m.records + n} records`,
        after: `${m.records} records`,
        context: {
          agentId: m.agentId,
          reason: `DSAR-${pad(int(rng, 1000, 9999), 4)} · GDPR Art. 17`,
        },
      })
    }
    if (m.ttlDays !== null && chance(rng, 0.5)) {
      const prev = m.ttlDays * 2
      out.push({
        at: hoursAgo(int(rng, 24 * 5, 24 * 50)),
        actor: userActor("u-001"),
        action: "memory.ttl.changed",
        source: "memory",
        target,
        summary: `${m.name} retention ${prev}d → ${m.ttlDays}d (${m.piiPolicy} PII)`,
        before: `${prev} days`,
        after: `${m.ttlDays} days`,
        context: { agentId: m.agentId, reason: "Data minimisation review" },
      })
    }
  }
  return out
}

/* ---- API keys ------------------------------------------------------------- */

function fromApiKeys(): Draft[] {
  const rng = createRng(9108)
  const out: Draft[] = []
  for (const k of apiKeys) {
    const target = {
      kind: "api-key",
      id: k.id,
      label: `${k.name} (${k.maskedKey})`,
      href: `/agentops/providers?tab=keys`,
    }
    out.push({
      at: k.created,
      actor: userActor(k.ownerId),
      action: "api_key.created",
      source: "api-key",
      target,
      summary: `Issued ${k.environment} key ${k.name} for ${k.providerId} with scopes ${k.scopes.join(", ")}`,
      after: k.scopes.join(", "),
      context: {},
    })
    if (k.status === "Revoked") {
      out.push({
        at: hoursAgo(int(rng, 24, 24 * 30)),
        actor: userActor(pick(rng, ["u-001", "u-006"])),
        action: "api_key.revoked",
        source: "api-key",
        target,
        summary: `Revoked ${k.name}`,
        before: "Active",
        after: "Revoked",
        context: { reason: "Key found in CI logs; rotated out of caution" },
      })
    } else if (k.status === "Rotating") {
      out.push({
        at: hoursAgo(int(rng, 1, 36)),
        actor: SYSTEM,
        action: "api_key.rotated",
        source: "api-key",
        target,
        summary: `Scheduled rotation started for ${k.name}; old secret valid for 24h`,
        before: k.maskedKey,
        after: `${k.maskedKey.slice(0, -4)}new…`,
        context: { reason: "90-day rotation policy" },
      })
    } else if (k.status === "Expiring" && k.expires) {
      out.push({
        at: hoursAgo(int(rng, 2, 48)),
        actor: SYSTEM,
        action: "api_key.expiry_warning",
        source: "api-key",
        target,
        summary: `${k.name} expires ${k.expires.slice(0, 10)}; owner notified`,
        context: { reason: "Expires within 14 days" },
      })
    }
  }
  return out
}

/* ---- Readiness ------------------------------------------------------------ */

function fromReadiness(): Draft[] {
  const target = {
    kind: "assessment",
    id: sampleAssessment.id,
    label: sampleAssessment.name,
    href: "/agentops/readiness",
  }
  const out: Draft[] = [
    {
      at: sampleAssessment.createdAt,
      actor: userActor("u-001"),
      action: "readiness.assessment.created",
      source: "readiness",
      target,
      summary: `Started ${sampleAssessment.name} against control set ${sampleAssessment.controlSetVersion}`,
      context: { agentId: "agt-support-triage" },
    },
    {
      at: sampleAssessment.updatedAt,
      actor: userActor("u-002"),
      action: "readiness.control.changed",
      source: "readiness",
      target: { ...target, kind: "control", id: "SAF-05", label: "SAF-05" },
      summary:
        "SAF-05 marked partial: approvals exist for destructive tools, external messaging still auto-sends",
      before: "planned",
      after: "partial",
      context: { agentId: "agt-support-triage", reason: "Vote 2/3 partial" },
    },
    {
      at: shift(sampleAssessment.updatedAt, -30),
      actor: userActor("u-004"),
      action: "readiness.control.changed",
      source: "readiness",
      target: { ...target, kind: "control", id: "QUA-03", label: "QUA-03" },
      summary: "QUA-03 moved to planned after judge agreement measured at 0.72",
      before: "partial",
      after: "planned",
      context: { agentId: "agt-support-triage" },
    },
  ]
  for (const s of sampleSnapshots) {
    out.push({
      at: s.takenAt,
      actor: userActor("u-001"),
      action: "readiness.snapshot.taken",
      source: "readiness",
      target: { ...target, kind: "snapshot", id: s.id, label: s.label },
      summary: `Snapshot "${s.label}" frozen for the ${s.assessment.target} gate`,
      context: { agentId: "agt-support-triage" },
    })
  }
  return out
}

/* ---- Seeded extras -------------------------------------------------------- */

function extras(count: number): Draft[] {
  const rng = createRng(9109)
  const out: Draft[] = []
  const operators = ["u-001", "u-002", "u-003", "u-004", "u-005", "u-006"]
  for (let i = 0; i < count; i++) {
    let agent = pick(rng, deployedAgents)
    const kind = int(rng, 0, 5)
    // Trace-linked events need an agent that actually ran, and a real trace.
    let traceId = ""
    if (kind === 2 || kind === 3) {
      const own = agentTraces.filter((t) => t.agentId === agent.id)
      const trace = pick(rng, own.length ? own : agentTraces)
      agent = deployedAgents.find((a) => a.id === trace.agentId) ?? agent
      traceId = trace.id
    }
    const target = {
      kind: "agent",
      id: agent.id,
      label: agent.name,
      href: `/agentops/agents/${agent.id}`,
    }
    const at = hoursAgo(int(rng, 1, 24 * 30))
    if (kind === 0) {
      out.push({
        at,
        actor: userActor(pick(rng, operators)),
        action: "agent.paused",
        source: "agent-config",
        target,
        summary: `Paused ${agent.name} pending guardrail review`,
        before: "Running",
        after: "Paused",
        context: { agentId: agent.id, reason: "Drift signal acknowledged" },
      })
      const resumedAt = shift(at, int(rng, 1, 9))
      out.push({
        // Never ahead of the demo clock.
        at: resumedAt > NOW.toISOString() ? hoursAgo(0.3) : resumedAt,
        actor: userActor(pick(rng, operators)),
        action: "agent.resumed",
        source: "agent-config",
        target,
        summary: `Resumed ${agent.name} after review`,
        before: "Paused",
        after: "Running",
        context: { agentId: agent.id },
      })
      i++
    } else if (kind === 1) {
      const from = agent.params.temperature
      const to = Math.round(Math.max(0, from - 0.1) * 10) / 10
      out.push({
        at,
        actor: userActor(agent.ownerId),
        action: "agent.config.params_changed",
        source: "agent-config",
        target,
        summary: `${agent.name} temperature ${from} → ${to} via playground apply`,
        before: String(from),
        after: String(to),
        context: { agentId: agent.id, promptVersion: agent.promptVersion },
      })
    } else if (kind === 2) {
      out.push({
        at,
        actor: agentActor(agent.id),
        action: "tool.permission.requested",
        source: "tool-permission",
        target: {
          kind: "tool",
          id: pick(rng, agent.tools),
          label: agent.tools[0] ?? "tool",
          href: `/agentops/tools?tab=permissions`,
        },
        summary: `${agent.name} requested approval for a write-risk tool call`,
        context: { agentId: agent.id, traceId },
      })
    } else if (kind === 3) {
      out.push({
        at,
        actor: SYSTEM,
        action: "guardrail.violation.escalated",
        source: "guardrail",
        target: {
          kind: "guardrail",
          id: "grd-pii-redaction",
          label: "PII redaction",
          href: "/agentops/guardrails?policy=grd-pii-redaction",
        },
        summary: `PII redaction escalated a verified violation on ${agent.name}`,
        context: { agentId: agent.id, traceId, policyVersion: "v3" },
      })
    } else if (kind === 4) {
      out.push({
        at,
        actor: userActor(pick(rng, operators)),
        action: "agent.owner.changed",
        source: "agent-config",
        target,
        summary: `${agent.name} ownership transferred`,
        before: getUser(agent.ownerId)?.name,
        after: getUser(pick(rng, operators))?.name,
        context: { agentId: agent.id },
      })
    } else {
      out.push({
        at,
        actor: SYSTEM,
        action: "audit.integrity.verified",
        source: "readiness",
        target: {
          kind: "audit-log",
          id: "audit-chain",
          label: "Audit chain",
          href: "/agentops/audit",
        },
        summary: "Nightly integrity check re-hashed the chain; no divergence",
        context: {},
      })
    }
  }
  return out.slice(0, count)
}

/* -------------------------------------------------------------------------- */
/* Assemble + chain                                                            */
/* -------------------------------------------------------------------------- */

const TARGET_COUNT = 140

/**
 * Per-source caps keep the trail balanced instead of letting release
 * activity drown everything else. High-signal verbs are always kept.
 */
const SOURCE_CAP: Record<AuditSource, number> = {
  release: 26,
  prompt: 16,
  guardrail: 14,
  "agent-config": 8,
  review: 8,
  "tool-permission": 8,
  "mcp-server": 6,
  budget: 8,
  memory: 9,
  "api-key": 9,
  readiness: 5,
}

const ALWAYS_KEEP = new Set([
  "release.rolled_back",
  "release.promoted",
  "release.failed",
  "release.rejected",
  "release.changes_requested",
  "memory.user_deleted",
  "api_key.revoked",
  "api_key.rotated",
  "guardrail.policy.disabled",
  "guardrail.threshold.changed",
  "budget.breached",
  "prompt.version.promoted",
  "prompt.version.rejected",
  "tool.permission.granted",
  "tool.permission.revoked",
  "tool.deprecated",
  "tool.disabled",
  "mcp_server.disconnected",
])

function capBySource(drafts: Draft[]): Draft[] {
  const out: Draft[] = []
  for (const source of auditSources) {
    const group = drafts
      .filter((d) => d.source === source)
      .sort((a, b) => b.at.localeCompare(a.at))
    const kept = group.filter((d) => ALWAYS_KEEP.has(d.action))
    const rest = group.filter((d) => !ALWAYS_KEEP.has(d.action))
    out.push(
      ...kept,
      ...rest.slice(0, Math.max(0, SOURCE_CAP[source] - kept.length))
    )
  }
  return out
}

function build(): AuditEvent[] {
  const derived = capBySource(
    [
      ...fromPrompts(),
      ...fromGuardrails(),
      ...fromReleases(),
      ...fromReviews(),
      ...fromTools(),
      ...fromBudgets(),
      ...fromMemory(),
      ...fromApiKeys(),
      ...fromReadiness(),
    ].filter((d) => new Date(d.at).getTime() <= NOW.getTime())
  )

  const drafts = [
    ...derived,
    ...extras(Math.max(0, TARGET_COUNT - derived.length)),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.action.localeCompare(b.action))

  let prev = AUDIT_GENESIS_HASH
  return drafts.map((d, i) => {
    const id = `aud-${pad(i + 1, 6)}`
    const hash = auditDigest(prev, { ...d, id })
    const event: AuditEvent = { id, ...d, hash, prevHash: prev }
    prev = hash
    return event
  })
}

export const auditEvents: AuditEvent[] = build()

export function getAuditEvent(id: string) {
  return auditEvents.find((e) => e.id === id)
}

export const auditRetention: AuditRetention = {
  retentionDays: 400,
  immutable: true,
  legalHold: auditEvents
    .filter(
      (e) =>
        e.action === "release.rolled_back" || e.action === "memory.user_deleted"
    )
    .slice(0, 4)
    .map((e) => e.id),
  storage: "WORM object storage",
  lastIntegrityCheck: hoursAgo(6),
}

/** Events within the trailing `days` window, newest first. */
export function auditEventsSince(days: number, events = auditEvents) {
  const since = NOW.getTime() - days * 86_400_000
  return events.filter((e) => new Date(e.at).getTime() >= since)
}
