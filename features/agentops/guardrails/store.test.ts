import { describe, expect, it } from "vitest"

import { guardrails, guardrailViolations } from "@/lib/data/guardrails"
import {
  computeGuardrailStats,
  falsePositiveRate,
  fpTone,
  policyStore,
  violationStore,
} from "./store"

describe("guardrails stores", () => {
  it("uses one false-positive definition for the fleet and per policy", () => {
    const fleet = falsePositiveRate(guardrailViolations)
    const decided = guardrailViolations.filter((v) => v.verdict !== "Pending")
    expect(fleet.decided).toBe(decided.length)
    expect(fleet.rate).toBeCloseTo(
      decided.filter((v) => v.verdict === "Dismissed").length / decided.length
    )
    const perPolicy = guardrails.map((g) =>
      falsePositiveRate(guardrailViolations, g.id)
    )
    expect(perPolicy.reduce((n, p) => n + p.decided, 0)).toBe(fleet.decided)
    expect(
      falsePositiveRate(guardrailViolations, "grd-does-not-exist").rate
    ).toBeNull()
    expect(fpTone(null)).toBeUndefined()
    expect(fpTone(0.2)).toBe("warning")
    expect(fpTone(0.4)).toBe("danger")
  })

  it("recomputes the fleet cards from the client lists", () => {
    violationStore.reset()
    policyStore.reset()
    const base = computeGuardrailStats(policyStore.get(), violationStore.get())
    const pending = violationStore.get().find((v) => v.verdict === "Pending")!
    violationStore.patch(pending.id, {
      verdict: "Dismissed",
      reviewerId: "u-001",
    })
    const after = computeGuardrailStats(policyStore.get(), violationStore.get())
    expect(after.decided).toBe(base.decided + 1)
    expect(after.pending).toBe(base.pending - 1)
    const active = policyStore.get().find((g) => g.status === "Active")!
    policyStore.patch(active.id, { status: "Disabled" })
    expect(
      computeGuardrailStats(policyStore.get(), violationStore.get()).active
    ).toBe(base.active - 1)
    violationStore.reset()
    policyStore.reset()
  })
})
