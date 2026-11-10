import { requests } from "@/lib/data/itsm"
import { createListStore } from "@/lib/store"
import type { Request } from "@/lib/types"

/**
 * Client-side copy of the request list shared by the requests table and the
 * catalog's request sheet, so an order placed in this session appears in the
 * list. Not persisted.
 */
export const requestsStore = createListStore<Request>(requests, (r) => r.number)

/** Next free request number, derived from the highest one in the store. */
export function nextRequestNumber(list: Request[] = requestsStore.get()) {
  const max = list.reduce(
    (m, r) => Math.max(m, Number(r.number.replace(/^REQ/, "")) || 0),
    0
  )
  return `REQ${String(max + 1).padStart(7, "0")}`
}

/** Next free requested-item number across every request in the store. */
export function nextItemNumber(list: Request[] = requestsStore.get()) {
  const max = list
    .flatMap((r) => r.items)
    .reduce(
      (m, i) => Math.max(m, Number(i.number.replace(/^RITM/, "")) || 0),
      0
    )
  return `RITM${String(max + 1).padStart(7, "0")}`
}
