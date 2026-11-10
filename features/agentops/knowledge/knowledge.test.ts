import { describe, expect, it } from "vitest"

import { agentTraces } from "@/lib/data"
import {
  getKnowledgeBase,
  ingestionJobs,
  kbSources,
  knowledgeBases,
  lowRecallQueries,
  memoryStores,
  retrievalDaily,
  searchKnowledgeBase,
} from "@/lib/data/knowledge"

describe("knowledge data", () => {
  it("links every source and job to a real knowledge base", () => {
    for (const s of kbSources) expect(getKnowledgeBase(s.kbId)).toBeDefined()
    for (const j of ingestionJobs) {
      expect(getKnowledgeBase(j.kbId)).toBeDefined()
      expect(kbSources.some((s) => s.id === j.sourceId)).toBe(true)
    }
  })

  it("points low-recall queries at real traces of the same agent", () => {
    for (const q of lowRecallQueries) {
      const trace = agentTraces.find((t) => t.id === q.traceId)
      expect(trace).toBeDefined()
      expect(trace?.agentId).toBe(q.agentId)
    }
  })

  it("keeps ids unique", () => {
    const ids = [
      ...knowledgeBases.map((k) => k.id),
      ...kbSources.map((s) => s.id),
      ...ingestionJobs.map((j) => j.id),
      ...memoryStores.map((m) => m.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(retrievalDaily).toHaveLength(14)
  })
})

describe("searchKnowledgeBase", () => {
  it("is deterministic and ranks the matching chunk first", () => {
    const a = searchKnowledgeBase("kb-product-docs", "export parquet via API")
    const b = searchKnowledgeBase("kb-product-docs", "export parquet via API")
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
    expect(a[0].chunk.docTitle).toBe("Exporting data")
    expect(a[0].matchedTerms.length).toBeGreaterThan(0)
    expect(a[0].rerankScore).toBeGreaterThanOrEqual(a[a.length - 1].rerankScore)
  })

  it("respects top_k and returns nothing for stopword-only queries", () => {
    const kb = getKnowledgeBase("kb-it-runbooks")!
    expect(
      searchKnowledgeBase(kb.id, "rollback canary pool").length
    ).toBeLessThanOrEqual(kb.retrieval.topK)
    expect(searchKnowledgeBase(kb.id, "the and of")).toEqual([])
    expect(searchKnowledgeBase("kb-missing", "anything")).toEqual([])
  })
})
