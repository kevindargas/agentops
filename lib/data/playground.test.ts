import { describe, expect, it } from "vitest"

import { deployedAgents } from "@/lib/data"
import { getBudget } from "@/lib/data/costs"
import { getGuardrail } from "@/lib/data/guardrails"
import { getKnowledgeBase } from "@/lib/data/knowledge"
import {
  configFromSearchParams,
  configToSearchParams,
  defaultPlaygroundConfig,
  diffParams,
  estimateCost,
  extractVariables,
  getAgentOpsConfig,
  renderPrompt,
  simulateRun,
} from "./playground"

describe("playground data", () => {
  it("extracts unique variables in order", () => {
    expect(
      extractVariables("Hi {{name}}, re {{ticket}}, {{name}} again {{ x }}")
    ).toEqual(["name", "ticket", "x"])
    expect(renderPrompt("{{a}}-{{b}}", { a: "1" })).toBe("1-{{b}}")
  })

  it("round-trips a config through search params", () => {
    const cfg = defaultPlaygroundConfig("agt-ops-analyst")
    cfg.params.temperature = 1.3
    cfg.params.stopSequences = ["END", "###"]
    cfg.params.seed = 42
    cfg.modelId = "openai/gpt-5.5"
    const back = configFromSearchParams(configToSearchParams(cfg))
    expect(back).toEqual(cfg)
  })

  it("falls back to deployed values for bad params", () => {
    const sp = new URLSearchParams({
      agent: "agt-support-triage",
      temp: "99",
      effort: "ultra",
      model: "nope/none",
    })
    const cfg = configFromSearchParams(sp)
    expect(cfg.params.temperature).toBe(2)
    expect(cfg.params.reasoningEffort).toBe("low")
    expect(cfg.modelId).toBe("anthropic/claude-sonnet-5.5")
  })

  it("diffs only the changed parameters", () => {
    const a = defaultPlaygroundConfig().params
    const b = { ...a, temperature: 0.9, toolChoice: "none" as const }
    expect(diffParams(b, a).map((d) => d.key)).toEqual([
      "temperature",
      "toolChoice",
    ])
  })

  it("simulates deterministically for the same config and input", () => {
    const cfg = defaultPlaygroundConfig("agt-support-triage")
    const r1 = simulateRun(cfg, "Customer cannot log in")
    const r2 = simulateRun(cfg, "Customer cannot log in")
    expect(r1).toEqual(r2)
    expect(r1.tools.length).toBeGreaterThan(0)
    expect(r1.answer.length).toBeGreaterThan(50)
    expect(r1.metrics.cost).toBeCloseTo(
      estimateCost(cfg.modelId, r1.metrics.tokensIn, r1.metrics.tokensOut)
    )
  })

  it("responds to parameter changes", () => {
    const base = defaultPlaygroundConfig("agt-change-risk")
    const hot = {
      ...base,
      params: {
        ...base.params,
        temperature: 1.5,
        responseFormat: "json_schema" as const,
      },
    }
    const noTools = {
      ...base,
      params: { ...base.params, toolChoice: "none" as const },
    }
    const r0 = simulateRun(base, "Assess CHG0041237")
    const r1 = simulateRun(hot, "Assess CHG0041237")
    const r2 = simulateRun(noTools, "Assess CHG0041237")
    expect(r1.metrics.quality).toBeLessThan(r0.metrics.quality)
    expect(r1.answer.startsWith("```json")).toBe(true)
    expect(r2.tools).toHaveLength(0)
    expect(simulateRun(base, "something else")).not.toEqual(r0)
  })

  it("derives an ops config for every agent from the other modules", () => {
    for (const a of deployedAgents) {
      const c = getAgentOpsConfig(a.id)
      expect(c.budgets.dailyCostCap).toBeGreaterThan(0)
      if (c.budgets.budgetId)
        expect(getBudget(c.budgets.budgetId)).toBeDefined()
      expect(c.guardrails.length).toBeGreaterThan(0)
      expect(c.guardrailIds.map((id) => getGuardrail(id)?.name)).toEqual(
        c.guardrails
      )
      expect(c.knowledgeSources.length).toBeGreaterThan(0)
      expect(
        c.knowledgeBaseIds.map((id) => getKnowledgeBase(id)?.name)
      ).toEqual(c.knowledgeSources)
    }
    expect(getAgentOpsConfig("agt-finance-copilot").autonomy).toBe("suggest")
    // Budgets below today's spend are the "Exceeded" story, not a bug.
    const triage = getAgentOpsConfig("agt-support-triage")
    expect(triage.budgets.budgetId).toBe("bud-003")
  })
})
