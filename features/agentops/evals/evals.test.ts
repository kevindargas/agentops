import { describe, expect, it } from "vitest"

import { deployedAgents } from "@/lib/data"
import {
  evalDatasets,
  evalRuns,
  evaluators,
  getDataset,
  getEvalCases,
  getEvalRun,
  releaseGates,
} from "@/lib/data/evals"

describe("evals data", () => {
  it("has a dataset for every agent's golden set", () => {
    for (const a of deployedAgents)
      expect(getDataset(a.evalDataset)).toBeDefined()
  })

  it("builds 30–50 runs with unique ev- ids and resolvable references", () => {
    expect(evalRuns.length).toBeGreaterThanOrEqual(30)
    expect(evalRuns.length).toBeLessThanOrEqual(50)
    expect(new Set(evalRuns.map((r) => r.id)).size).toBe(evalRuns.length)
    for (const r of evalRuns) {
      expect(r.id).toMatch(/^ev-\d+$/)
      expect(getDataset(r.datasetId)).toBeDefined()
      expect(deployedAgents.some((a) => a.id === r.agentId)).toBe(true)
      for (const e of r.evaluatorIds)
        expect(evaluators.some((x) => x.id === e)).toBe(true)
      if (r.baselineRunId) expect(getEvalRun(r.baselineRunId)).toBeDefined()
    }
  })

  it("generates cases lazily with counts that match the run", () => {
    const run = evalRuns.find((r) => r.status === "Failed")!
    const cases = getEvalCases(run.id)
    expect(cases.length).toBe(run.cases)
    expect(cases.filter((c) => c.passed).length).toBe(run.passed)
    expect(cases.filter((c) => c.change === "regression").length).toBe(
      run.regressions
    )
    expect(cases.filter((c) => c.change === "improvement").length).toBe(
      run.improvements
    )
    // Memoised and deterministic.
    expect(getEvalCases(run.id)).toBe(cases)
    for (const c of cases.filter((c) => !c.passed))
      expect(Object.values(c.scores).some((s) => s < 0.75)).toBe(true)
  })

  it("returns no cases for in-flight runs", () => {
    const running = evalRuns.find((r) => r.status === "Running")!
    expect(getEvalCases(running.id)).toEqual([])
  })

  it("has one gate per agent with five rules", () => {
    expect(releaseGates.length).toBe(deployedAgents.length)
    for (const g of releaseGates) expect(g.rules).toHaveLength(5)
    expect(evalDatasets.length).toBeGreaterThanOrEqual(10)
  })
})
