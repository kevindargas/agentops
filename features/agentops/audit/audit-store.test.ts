import { describe, expect, it } from "vitest"

import { auditEvents, verifyAuditChain } from "@/lib/data/audit"
import {
  auditHref,
  auditStore,
  recordAudit,
  sessionAuditIds,
} from "./audit-store"

describe("client audit store", () => {
  it("appends hash-chained records that keep the chain verifiable", () => {
    auditStore.reset()
    const before = auditStore.get().length
    expect(before).toBe(auditEvents.length)
    const event = recordAudit({
      action: "release.rolled_back",
      source: "release",
      target: {
        kind: "release",
        id: "rel-1006",
        label: "Support Triage v2.5.0",
        href: "/agentops/deployments/rel-1006",
      },
      summary: "Rolled back rel-1006 to v2.4.3",
      context: { releaseId: "rel-1006", reason: "Error rate above tolerance" },
    })
    const items = auditStore.get()
    expect(items.length).toBe(before + 1)
    expect(event.id).toBe(`aud-${String(before + 1).padStart(6, "0")}`)
    expect(event.prevHash).toBe(auditEvents[auditEvents.length - 1].hash)
    expect(verifyAuditChain(items)).toEqual({ ok: true })
    expect(sessionAuditIds.has(event.id)).toBe(true)
    // Tampering with the appended record is still detected.
    const tampered = items.map((e) =>
      e.id === event.id ? { ...e, summary: "edited" } : e
    )
    expect(verifyAuditChain(tampered).ok).toBe(false)
    auditStore.reset()
  })

  it("builds the filtered audit link", () => {
    expect(auditHref("release", "rel-1006")).toBe(
      "/agentops/audit?source=release&q=rel-1006"
    )
    expect(auditHref("guardrail")).toBe("/agentops/audit?source=guardrail")
  })
})
