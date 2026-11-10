import { describe, expect, it } from "vitest"

import { getDeployedAgent } from "@/lib/data/agentops"
import {
  GATE_THRESHOLD,
  getRelease,
  releaseApprovals,
  releasePromptVersion,
  releases,
} from "@/lib/data/deployments"
import { getEvalRun } from "@/lib/data/evals"
import { getPromptVersion } from "@/lib/data/prompts"
import { getUser } from "@/lib/data/users"

describe("deployments data", () => {
  it("resolves every release to a real agent, author and approvers", () => {
    expect(releases.length).toBeGreaterThan(20)
    expect(new Set(releases.map((r) => r.id)).size).toBe(releases.length)
    for (const r of releases) {
      expect(r.id).toMatch(/^rel-\d+$/)
      expect(getDeployedAgent(r.agentId), r.id).toBeDefined()
      expect(getUser(r.deployedById), r.id).toBeDefined()
      for (const a of r.approvers) expect(getUser(a.userId), r.id).toBeDefined()
    }
  })

  it("points every eval gate at an existing run of the same agent", () => {
    for (const r of releases) {
      if (!r.evalGate) continue
      const run = getEvalRun(r.evalGate.runId)
      expect(run, `${r.id} -> ${r.evalGate.runId}`).toBeDefined()
      expect(run?.agentId).toBe(r.agentId)
      expect(r.evalGate.threshold).toBe(GATE_THRESHOLD)
      expect(r.evalGate.score).toBe(run?.composite)
      if (r.evalGate.status === "failed") expect(r.evalGate.reason).toBeTruthy()
    }
  })

  it("only leaves Draft releases without a gate", () => {
    const ungated = releases.filter((r) => !r.evalGate)
    expect(ungated.length).toBeGreaterThan(0)
    for (const r of ungated) expect(r.stage, r.id).toBe("Draft")
  })

  it("resolves prompt changes to the agent's own prompt versions", () => {
    for (const r of releases) {
      const change = r.changes.find((c) => c.kind === "prompt")
      if (!change) continue
      const version = getPromptVersion(change.after)
      expect(version, `${r.id} -> ${change.after}`).toBeDefined()
      expect(releasePromptVersion(r)?.id).toBe(change.after)
    }
  })

  it("derives approvals from pending releases and keeps a gate reason", () => {
    for (const a of releaseApprovals) {
      const r = getRelease(a.releaseId)
      expect(r, a.id).toBeDefined()
      expect(r?.stage).toBe("Pending approval")
    }
    const failing = releaseApprovals.find(
      (a) => a.evidence.evalGate?.status === "failed"
    )
    expect(failing?.evidence.evalGate?.reason).toMatch(/regression/)
  })
})
