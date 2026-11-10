import { afterEach, describe, expect, it } from "vitest"

import { deployedAgents } from "@/lib/data/agentops"
import { prompts } from "@/lib/data/prompts"
import {
  diffAllParams,
  readPenaltyParams,
  writePenaltyParams,
} from "@/features/agentops/playground/param-fields"
import {
  createPrompt,
  createVersion,
  nextVersionNumber,
  promptForAgent,
  promptStore,
  setVersionLabel,
  versionsForAgent,
} from "./prompt-store"

afterEach(() => promptStore.reset())

describe("prompt store", () => {
  it("starts from the seed and resolves every agent's prompt", () => {
    expect(promptStore.get()).toHaveLength(prompts.length)
    for (const a of deployedAgents) {
      const versions = versionsForAgent(a.id)
      expect(
        versions.some((v) => v.id === a.promptVersion),
        a.id
      ).toBe(true)
      expect(versions[0].number).toBeGreaterThanOrEqual(
        versions[versions.length - 1].number
      )
    }
  })

  it("creates drafts with a globally unique next id", () => {
    const prompt = promptForAgent("agt-it-helpdesk")!
    const before = nextVersionNumber()
    const v = createVersion({
      promptId: prompt.id,
      template: "hello {{employee}}",
      modelId: prompt.versions[0].modelId,
      params: prompt.versions[0].params,
      changeNote: "test",
    })
    expect(v?.id).toBe(`p-${before}`)
    expect(v?.label).toBe("draft")
    expect(versionsForAgent("agt-it-helpdesk")[0].id).toBe(v?.id)
    expect(nextVersionNumber()).toBe(before + 1)
  })

  it("promotes one version and archives the previous production", () => {
    const prompt = promptForAgent("agt-support-triage")!
    const prod = prompt.versions.find((v) => v.label === "production")!
    const staging = prompt.versions.find((v) => v.label === "staging")!
    setVersionLabel(prompt.id, staging.id, "production")
    const next = promptStore.get().find((p) => p.id === prompt.id)!
    expect(next.versions.find((v) => v.id === staging.id)?.label).toBe(
      "production"
    )
    expect(next.versions.find((v) => v.id === prod.id)?.label).toBe("archived")
    expect(next.versions.filter((v) => v.label === "production")).toHaveLength(
      1
    )
  })

  it("registers a new prompt with a unique id and a first draft", () => {
    const a = deployedAgents[0]
    const p1 = createPrompt({
      name: "Escalation note",
      agentId: a.id,
      type: "user_template",
      template: "Escalate {{ticket}}",
      modelId: a.modelId,
      params: a.params,
    })
    const p2 = createPrompt({
      name: "Escalation note",
      agentId: a.id,
      type: "user_template",
      template: "Escalate {{ticket}} again",
      modelId: a.modelId,
      params: a.params,
    })
    expect(p1.id).not.toBe(p2.id)
    expect(promptStore.get()[0].id).toBe(p2.id)
    expect(p1.versions[0].label).toBe("draft")
  })
})

describe("penalty params", () => {
  const base = deployedAgents[0].params

  it("diffs frequency and presence penalties", () => {
    const d = diffAllParams({ ...base, frequencyPenalty: 0.5 }, base)
    expect(d.map((x) => x.key)).toEqual(["frequencyPenalty"])
    expect(d[0].from).toBe("none")
    expect(d[0].to).toBe("0.5")
  })

  it("round-trips through the share link", () => {
    const sp = writePenaltyParams(new URLSearchParams(), {
      ...base,
      frequencyPenalty: 0.5,
      presencePenalty: -1.2,
    })
    const out = readPenaltyParams(sp, base)
    expect(out.frequencyPenalty).toBe(0.5)
    expect(out.presencePenalty).toBe(-1.2)
    expect(
      readPenaltyParams(new URLSearchParams("freq_penalty=9"), base)
        .frequencyPenalty
    ).toBe(2)
  })
})
