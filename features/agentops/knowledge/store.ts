import {
  daysSince,
  kbSources,
  knowledgeBases,
  memoryStores,
  STALE_AFTER_DAYS,
  type KbSource,
  type KnowledgeBase,
  type MemoryStore,
} from "@/lib/data/knowledge"
import { createListStore } from "@/lib/store"

/**
 * Module-scoped client stores for Knowledge & Memory. The stat row, the tab
 * counts and the tables all read the same lists, so re-indexing a base,
 * pausing a source or forgetting a record moves every number on the page.
 * Not persisted: a reload returns to the seed.
 */
export const kbStore = createListStore<KnowledgeBase>(
  knowledgeBases,
  (k) => k.id
)
export const sourceStore = createListStore<KbSource>(kbSources, (s) => s.id)
export const memoryStore = createListStore<MemoryStore>(
  memoryStores,
  (m) => m.id
)

export function isSourceStale(s: KbSource) {
  return (
    s.status === "Failed" ||
    s.status === "Paused" ||
    daysSince(s.lastSync) > STALE_AFTER_DAYS
  )
}

/** Same shape as `kbTotals` in `lib/data/knowledge.ts`, computed from the stores. */
export function knowledgeTotals(
  bases: readonly KnowledgeBase[],
  sources: readonly KbSource[],
  memory: readonly MemoryStore[]
) {
  return {
    knowledgeBases: bases.length,
    healthy: bases.filter((k) => k.status === "Healthy").length,
    documents: bases.reduce((n, k) => n + k.documents, 0),
    chunks: bases.reduce((n, k) => n + k.chunks, 0),
    sources: sources.length,
    staleSources: sources.filter(isSourceStale).length,
    failedSources: sources.filter((s) => s.status === "Failed").length,
    memoryRecords: memory.reduce((n, m) => n + m.records, 0),
    longTermStores: memory.filter((m) => m.type !== "session").length,
  }
}
