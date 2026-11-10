import { describe, expect, it } from "vitest"

import {
  contextFromPathname,
  planResponse,
  starterPrompts,
  type AssistantContext,
} from "@/lib/ai/assistant"
import { agentTemplates, templatePrompt } from "@/lib/ai/templates"
import {
  agentTraces,
  changes,
  deployedAgents,
  incidents,
  knowledgeArticles,
  problems,
  requests,
} from "@/lib/data"

const isFallback = (ctx: AssistantContext, prompt: string) =>
  planResponse(prompt, ctx).steps.some(
    (s) => s.kind === "tool" && s.name === "search_records"
  )

const sampleContext: Record<
  NonNullable<AssistantContext["recordType"]>,
  AssistantContext
> = {
  incident: contextFromPathname(`/itsm/incidents/${incidents[0].number}`),
  change: contextFromPathname(`/itsm/changes/${changes[0].number}`),
  problem: contextFromPathname(`/itsm/problems/${problems[0].number}`),
  request: contextFromPathname(`/itsm/requests/${requests[0].number}`),
  knowledge: contextFromPathname(
    `/itsm/knowledge/${knowledgeArticles[0].number}`
  ),
  agent: contextFromPathname(`/agentops/agents/${deployedAgents[0].id}`),
  trace: contextFromPathname(`/agentops/traces/${agentTraces[0].id}`),
}

describe("contextFromPathname", () => {
  it("detects every record type from its route", () => {
    for (const [type, ctx] of Object.entries(sampleContext)) {
      expect(ctx.recordType, type).toBe(type)
      expect(ctx.recordNumber, type).toBeTruthy()
    }
    expect(contextFromPathname("/dashboard").recordType).toBeUndefined()
  })
})

describe("planResponse", () => {
  it("answers every starter prompt without falling back to generic search", () => {
    for (const [type, ctx] of Object.entries(sampleContext)) {
      for (const prompt of starterPrompts(ctx)) {
        expect(isFallback(ctx, prompt), `${type}: "${prompt}"`).toBe(false)
      }
    }
  })

  it("answers workspace starters from any page", () => {
    const ctx = contextFromPathname("/dashboard")
    for (const prompt of starterPrompts(ctx))
      expect(isFallback(ctx, prompt), prompt).toBe(false)
  })

  it("always ends with a text step and offers follow-ups", () => {
    const run = planResponse("Summarize this incident", sampleContext.incident)
    expect(run.steps.some((s) => s.kind === "text")).toBe(true)
    expect(run.steps.at(-1)?.kind).toBe("suggestions")
  })

  it("answers agent-ops questions from any page", () => {
    const ctx = contextFromPathname("/dashboard")
    for (const prompt of [
      "Which agents are over budget?",
      "Why did Support Triage's quality drop this week?",
      "Show me the latest prompt version for the helpdesk agent",
    ])
      expect(isFallback(ctx, prompt), prompt).toBe(false)
    const run = planResponse(
      "Show me the latest prompt version for the helpdesk agent",
      ctx
    )
    const text = run.steps.find((s) => s.kind === "text")
    expect(text && "markdown" in text ? text.markdown : "").toContain(
      "IT Helpdesk Copilot"
    )
  })

  it("falls back to record search for unknown prompts", () => {
    expect(isFallback(contextFromPathname("/dashboard"), "banana")).toBe(true)
  })
})

describe("agentic templates", () => {
  it("every template produces a real scripted answer in a context it applies to", () => {
    for (const t of agentTemplates) {
      const ctx = t.appliesTo
        ? sampleContext[t.appliesTo[0]]
        : contextFromPathname("/dashboard")
      const prompt = templatePrompt(t, ctx)
      expect(isFallback(ctx, prompt), `${t.id}: "${prompt}"`).toBe(false)
    }
  })

  it("fills the record number into the prompt", () => {
    const t = agentTemplates.find((x) => x.prompt.includes("{record}"))!
    expect(templatePrompt(t, sampleContext.incident)).toContain(
      sampleContext.incident.recordNumber!
    )
    expect(templatePrompt(t, contextFromPathname("/dashboard"))).toContain(
      "this record"
    )
  })
})
