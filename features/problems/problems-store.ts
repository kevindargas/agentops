import { problems } from "@/lib/data/itsm"
import { createListStore } from "@/lib/store"
import type { Problem } from "@/lib/types"

/**
 * Client-side copy of the problem list shared by the problems table and the
 * New problem sheet. Not persisted.
 */
export const problemsStore = createListStore<Problem>(problems, (p) => p.number)

/** Next free problem number, derived from the highest one in the store. */
export function nextProblemNumber(list: Problem[] = problemsStore.get()) {
  const max = list.reduce(
    (m, p) => Math.max(m, Number(p.number.replace(/^PRB/, "")) || 0),
    0
  )
  return `PRB${String(max + 1).padStart(7, "0")}`
}
