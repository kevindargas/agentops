import { describe, expect, it } from "vitest"

import { agentTraces, deployedAgents, getUser } from "@/lib/data"
import {
  evaluateGuardrails,
  getGuardrail,
  guardrailCoverage,
  guardrailPresets,
  guardrails,
  guardrailViolations,
} from "@/lib/data/guardrails"

describe("guardrails data", () => {
  it("has 14–20 policies with unique ids and real owners", () => {
    expect(guardrails.length).toBeGreaterThanOrEqual(14)
    expect(guardrails.length).toBeLessThanOrEqual(20)
    expect(new Set(guardrails.map((g) => g.id)).size).toBe(guardrails.length)
    for (const g of guardrails) {
      expect(getUser(g.ownerId), g.id).toBeDefined()
      expect(g.history).toHaveLength(14)
      expect(g.versions).toHaveLength(3)
      if (g.scope !== "all")
        for (const id of g.scope)
          expect(
            deployedAgents.some((a) => a.id === id),
            id
          ).toBe(true)
    }
  })

  it("links violations to real traces, agents and policies", () => {
    expect(guardrailViolations.length).toBeGreaterThanOrEqual(60)
    expect(guardrailViolations.length).toBeLessThanOrEqual(100)
    const traceIds = new Set(agentTraces.map((t) => t.id))
    for (const v of guardrailViolations) {
      expect(traceIds.has(v.traceId), v.id).toBe(true)
      expect(getGuardrail(v.policyId), v.id).toBeDefined()
      expect(
        deployedAgents.some((a) => a.id === v.agentId),
        v.id
      ).toBe(true)
    }
  })

  it("is deterministic", () => {
    const a = JSON.stringify(guardrailViolations.slice(0, 5))
    const b = JSON.stringify(guardrailViolations.slice(0, 5))
    expect(a).toBe(b)
    expect(guardrailViolations[0].id).toMatch(/^vio-\d{4}$/)
  })

  it("scores coverage and reports gaps", () => {
    const c = guardrailCoverage("agt-ops-analyst")
    expect(c.counts.Output).toBe(0)
    expect(c.gaps).toContain("Output")
    const full = guardrailCoverage("agt-support-triage")
    expect(full.gaps).toHaveLength(0)
    expect(full.score).toBeGreaterThan(c.score)
  })
})

describe("evaluateGuardrails", () => {
  it("redacts PII and blocks injection", () => {
    const pii = evaluateGuardrails(guardrailPresets[0].text, "all")
    expect(pii.map((r) => r.policy.id)).toContain("grd-pii-redaction")
    expect(pii.find((r) => r.policy.id === "grd-pii-redaction")?.action).toBe(
      "Redacted"
    )
    const inj = evaluateGuardrails(guardrailPresets[1].text, "all")
    expect(
      inj.find((r) => r.policy.id === "grd-prompt-injection")?.action
    ).toBe("Blocked")
  })

  it("respects agent scope and policy status", () => {
    // Destructive approval only applies to writer agents.
    const hr = evaluateGuardrails(guardrailPresets[3].text, "agt-hr-answers")
    expect(hr.some((r) => r.policy.id === "grd-destructive-approval")).toBe(
      false
    )
    const ops = evaluateGuardrails(guardrailPresets[3].text, "agt-ops-analyst")
    expect(ops.some((r) => r.policy.id === "grd-destructive-approval")).toBe(
      true
    )
    // Disabled competitor policy never trips.
    const comp = evaluateGuardrails(
      "Compared to Zendesk…",
      "agt-support-triage"
    )
    expect(comp.some((r) => r.policy.id === "grd-competitor-mention")).toBe(
      false
    )
  })

  it("passes clean text", () => {
    expect(
      evaluateGuardrails("How do I reset my VPN password?", "all")
    ).toHaveLength(0)
  })
})
