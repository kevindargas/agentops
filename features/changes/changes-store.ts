import { changes } from "@/lib/data/itsm"
import { createListStore } from "@/lib/store"
import type { Change } from "@/lib/types"

/**
 * Client-side copy of the change list shared by the changes table, the change
 * calendar and the New change sheet, so a change created in this session shows
 * up in both views. Not persisted.
 */
export const changesStore = createListStore<Change>(changes, (c) => c.number)

/** Next free change number, derived from the highest one in the store. */
export function nextChangeNumber(list: Change[] = changesStore.get()) {
  const max = list.reduce(
    (m, c) => Math.max(m, Number(c.number.replace(/^CHG/, "")) || 0),
    0
  )
  return `CHG${String(max + 1).padStart(7, "0")}`
}
