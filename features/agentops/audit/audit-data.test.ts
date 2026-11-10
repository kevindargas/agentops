import { describe, expect, it } from "vitest"

import {
  AUDIT_GENESIS_HASH,
  auditEvents,
  auditRetention,
  auditSources,
  getAuditEvent,
  verifyAuditChain,
} from "@/lib/data/audit"
import { NOW } from "@/lib/data/seed"

describe("audit log data", () => {
  it("builds ~140 chronologically ordered events with unique ids", () => {
    expect(auditEvents.length).toBe(140)
    expect(new Set(auditEvents.map((e) => e.id)).size).toBe(auditEvents.length)
    for (let i = 1; i < auditEvents.length; i++)
      expect(auditEvents[i - 1].at <= auditEvents[i].at).toBe(true)
    for (const e of auditEvents)
      expect(new Date(e.at).getTime()).toBeLessThanOrEqual(NOW.getTime())
  })

  it("covers every source and both derived and seeded actors", () => {
    const sources = new Set(auditEvents.map((e) => e.source))
    for (const s of auditSources) expect(sources, s).toContain(s)
    const kinds = new Set(auditEvents.map((e) => e.actor.kind))
    expect(kinds).toEqual(new Set(["user", "agent", "system"]))
  })

  it("links every target to an existing route", () => {
    for (const e of auditEvents) {
      expect(e.target.href.startsWith("/agentops/")).toBe(true)
      expect(e.id).toMatch(/^aud-\d{6}$/)
    }
  })

  it("verifies the hash chain and detects tampering", () => {
    expect(auditEvents[0].prevHash).toBe(AUDIT_GENESIS_HASH)
    expect(verifyAuditChain(auditEvents)).toEqual({ ok: true })
    const tampered = auditEvents.map((e, i) =>
      i === 40 ? { ...e, summary: e.summary + " (edited)" } : e
    )
    expect(verifyAuditChain(tampered)).toEqual({
      ok: false,
      brokenAt: auditEvents[40].id,
    })
    const dropped = auditEvents.filter((_, i) => i !== 10)
    expect(verifyAuditChain(dropped).ok).toBe(false)
  })

  it("resolves ids and pins legal-hold events", () => {
    expect(getAuditEvent(auditEvents[5].id)).toBe(auditEvents[5])
    expect(getAuditEvent("aud-999999")).toBeUndefined()
    expect(auditRetention.legalHold.length).toBeGreaterThan(0)
    for (const id of auditRetention.legalHold)
      expect(getAuditEvent(id)).toBeDefined()
  })
})
