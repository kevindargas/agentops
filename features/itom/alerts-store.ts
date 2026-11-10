import { alerts } from "@/lib/data/itom"
import { NOW, pad } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { createListStore } from "@/lib/store"
import type { Alert } from "@/lib/types"

/**
 * Client-side alert list shared by the alerts table, the stat row and the
 * alert detail sheet so acknowledging, closing or promoting an alert moves
 * every number on the page. Not persisted: a reload returns to the seed.
 */
export const alertsStore = createListStore<Alert>(alerts, (a) => a.number)

export const openAlerts = (list: Alert[]) =>
  list.filter((a) => a.state !== "Closed")

export function acknowledgeAlerts(numbers: string[]) {
  for (const n of numbers)
    alertsStore.patch(n, {
      acknowledged: true,
      acknowledgedById: currentUser.id,
      updated: NOW.toISOString(),
    })
}

export function closeAlerts(numbers: string[]) {
  for (const n of numbers)
    alertsStore.patch(n, { state: "Closed", updated: NOW.toISOString() })
}

/** Incident numbers minted in this session continue after the seeded range. */
let mintedIncidents = 0

/**
 * Link alerts to a new incident number. The incident itself lives in the
 * incidents module and is not created here; the alerts simply carry the
 * number so the Incident column and the sheet show the promotion.
 */
export function promoteAlerts(numbers: string[]) {
  mintedIncidents += 1
  const incidentNumber = `INC${pad(10079 + mintedIncidents)}`
  for (const n of numbers)
    alertsStore.patch(n, {
      incidentNumber,
      acknowledged: true,
      acknowledgedById: currentUser.id,
      updated: NOW.toISOString(),
    })
  return incidentNumber
}
