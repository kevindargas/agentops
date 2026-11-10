import { describe, expect, it } from "vitest"

import { proposals, toolCatalog, toolCategoryFor } from "@/lib/ai/agents"
import { redactPii } from "@/lib/ai/assistant"
import { getPrompt, getPromptVersion } from "@/lib/data/prompts"

describe("redactPii", () => {
  it("masks e-mail, IBAN and phone numbers and counts them", () => {
    const { text, redacted } = redactPii(
      "Contact priya.raman@example.com or +49 30 1234 5678, IBAN DE89 3704 0044 0532 0130 00."
    )
    expect(text).toContain("[email]")
    expect(text).toContain("[phone]")
    expect(text).toContain("[iban]")
    expect(text).not.toContain("example.com")
    expect(redacted).toBe(3)
  })

  it("leaves ordinary prompts alone", () => {
    const prompt = "Summarize INC0010048 for a stakeholder briefing"
    expect(redactPii(prompt)).toEqual({ text: prompt, redacted: 0 })
  })
})

describe("toolCategoryFor", () => {
  it("maps every scripted tool name onto a catalog id", () => {
    const ids = new Set(toolCatalog.map((t) => t.id))
    for (const name of [
      "read_incident",
      "search_knowledge",
      "update_incident",
      "create_incident",
      "close_alert",
      "send_notification",
      "update_tool_permissions",
      "retire_prompt_version",
    ])
      expect(ids.has(toolCategoryFor(name)), name).toBe(true)
    expect(toolCategoryFor("search_knowledge")).toBe("search_knowledge")
    expect(toolCategoryFor("update_tool_permissions")).toBe(
      "change_agent_config"
    )
    expect(toolCategoryFor("close_alert")).toBe("close_records")
    expect(toolCategoryFor("read_agent_metrics")).toBe("read_records")
  })
})

describe("workflow proposals", () => {
  it("only name prompt versions that belong to the agent they talk about", () => {
    for (const p of proposals) {
      if (!p.recordNumber.startsWith("agt-")) continue
      for (const id of p.action.match(/\bp-\d+\b/g) ?? []) {
        const version = getPromptVersion(id)
        expect(version, `${p.id} names ${id}`).toBeDefined()
        expect(
          getPrompt(version!.promptId)?.agentId,
          `${p.id}: ${id} belongs to another agent`
        ).toBe(p.recordNumber)
      }
      for (const d of p.diff ?? [])
        for (const id of `${d.from} ${d.to}`.match(/\bp-\d+\b/g) ?? [])
          expect(getPromptVersion(id), `${p.id} diff names ${id}`).toBeDefined()
    }
  })
})
