import { incidents } from "@/lib/data/itsm"
import { createListStore } from "@/lib/store"
import type { Incident } from "@/lib/types"

/**
 * Client-side copy of the incident list shared by the table, its bulk and row
 * actions and the New incident sheet, so a created, assigned or resolved
 * incident is visible wherever the list renders. Not persisted.
 */
export const incidentsStore = createListStore<Incident>(
  incidents,
  (i) => i.number
)

/** Next free incident number, derived from the highest one in the store. */
export function nextIncidentNumber(list: Incident[] = incidentsStore.get()) {
  const max = list.reduce(
    (m, i) => Math.max(m, Number(i.number.replace(/^INC/, "")) || 0),
    0
  )
  return `INC${String(max + 1).padStart(7, "0")}`
}
