import { knowledgeArticles } from "@/lib/data/catalog"
import { createListStore } from "@/lib/store"
import type { KnowledgeArticle } from "@/lib/types"

/**
 * Client-side copy of the article list shared by the knowledge table and the
 * New article sheet. Not persisted.
 */
export const knowledgeStore = createListStore<KnowledgeArticle>(
  knowledgeArticles,
  (a) => a.number
)

/** Next free article number, derived from the highest one in the store. */
export function nextArticleNumber(
  list: KnowledgeArticle[] = knowledgeStore.get()
) {
  const max = list.reduce(
    (m, a) => Math.max(m, Number(a.number.replace(/^KB/, "")) || 0),
    0
  )
  return `KB${String(max + 1).padStart(7, "0")}`
}
