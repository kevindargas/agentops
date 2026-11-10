import { describe, expect, it } from "vitest"

import { deployedAgents, experiments } from "@/lib/data"
import {
  extractVariables,
  getPrompt,
  getPromptForAgent,
  getPromptVersion,
  productionVersion,
  prompts,
  promptVersions,
} from "@/lib/data/prompts"

describe("prompt registry", () => {
  it("has unique prompt and version ids", () => {
    expect(new Set(prompts.map((p) => p.id)).size).toBe(prompts.length)
    expect(new Set(promptVersions.map((v) => v.id)).size).toBe(
      promptVersions.length
    )
    expect(prompts.length).toBeGreaterThanOrEqual(10)
  })

  it("resolves every prompt version referenced by agents and experiments", () => {
    for (const a of deployedAgents) {
      const v = getPromptVersion(a.promptVersion)
      expect(v, a.promptVersion).toBeDefined()
      expect(v?.label).toBe("production")
      expect(getPromptForAgent(a.id)?.id).toBe(v?.promptId)
    }
    for (const e of experiments)
      for (const variant of e.variants)
        if (variant.promptVersion)
          expect(getPromptVersion(variant.promptVersion)).toBeDefined()
  })

  it("has exactly one production version per prompt and documents its variables", () => {
    for (const p of prompts) {
      expect(p.versions.filter((v) => v.label === "production")).toHaveLength(1)
      const prod = productionVersion(p)!
      for (const name of extractVariables(prod.template))
        expect(p.variables[name], `${p.id}:${name}`).toBeDefined()
    }
  })

  it("is deterministic across module evaluation", () => {
    const a = getPrompt("prm-support-system")!
    expect(a.versions.map((v) => v.id)).toEqual([
      "p-38",
      "p-39",
      "p-40",
      "p-41",
      "p-42",
    ])
    expect(a.versions[3].evalScore).toBeCloseTo(91, 0)
  })

  it("extracts variables once, in order", () => {
    expect(extractVariables("{{a}} {{ b }} {{a}}")).toEqual(["a", "b"])
  })
})
