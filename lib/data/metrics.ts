/**
 * Period-over-period helpers so stat cards derive their deltas from the same
 * records they count instead of shipping literal trends. Everything is
 * anchored to the frozen demo clock (`NOW`).
 */

import { approvals } from "./activity"
import { alerts } from "./itom"
import { incidents, requests } from "./itsm"
import { NOW } from "./seed"

export interface WindowComparison {
  /** Value for the most recent window. */
  current: number
  /** Value for the window immediately before it. */
  previous: number
  /** `current - previous`. */
  delta: number
  /** Percent change versus `previous`; null when `previous` is 0. */
  deltaPct: number | null
}

function compare(current: number, previous: number): WindowComparison {
  const delta = Math.round((current - previous) * 100) / 100
  return {
    current,
    previous,
    delta,
    deltaPct:
      previous === 0 ? null : Math.round((delta / previous) * 1000) / 10,
  }
}

/**
 * Compare the last `days` points of a daily series with the `days` before
 * them (sums). Works for any numeric series ordered oldest first, e.g.
 * `fleetDaily.map((d) => d.cost)` or `usageByDay.map((d) => d.actions)`.
 */
export function compareWindows(
  series: number[],
  days: number,
  reduce: (values: number[]) => number = (v) => v.reduce((s, x) => s + x, 0)
): WindowComparison {
  const current = series.slice(-days)
  const previous = series.slice(-2 * days, -days)
  return compare(reduce(current), previous.length ? reduce(previous) : 0)
}

/** Mean of a numeric array, 0 when empty. */
export const mean = (values: number[]) =>
  values.length ? values.reduce((s, x) => s + x, 0) / values.length : 0

const DAY = 86_400_000

function inWindow(iso: string, fromMs: number, toMs: number) {
  const t = new Date(iso).getTime()
  return t >= fromMs && t < toMs
}

/**
 * Count items whose timestamp falls in the last `days` versus the `days`
 * before. `at` picks the timestamp of an item.
 */
export function countInWindows<T>(
  items: readonly T[],
  at: (item: T) => string | undefined,
  days: number,
  from: Date = NOW
): WindowComparison {
  return sumInWindows(items, at, () => 1, days, from)
}

/** Like `countInWindows` but sums `value(item)` instead of counting. */
export function sumInWindows<T>(
  items: readonly T[],
  at: (item: T) => string | undefined,
  value: (item: T) => number,
  days: number,
  from: Date = NOW
): WindowComparison {
  const end = from.getTime()
  const mid = end - days * DAY
  const start = mid - days * DAY
  let current = 0
  let previous = 0
  for (const item of items) {
    const iso = at(item)
    if (!iso) continue
    if (inWindow(iso, mid, end)) current += value(item)
    else if (inWindow(iso, start, mid)) previous += value(item)
  }
  return compare(current, previous)
}

/**
 * Number of records open at `at` versus `days` earlier. A record counts as
 * open at a moment when it was opened before it and not yet closed.
 */
export function openCountDelta<T>(
  items: readonly T[],
  opened: (item: T) => string,
  closed: (item: T) => string | undefined,
  days: number,
  at: Date = NOW
): WindowComparison {
  const openAt = (ms: number) =>
    items.filter((i) => {
      const o = new Date(opened(i)).getTime()
      const c = closed(i)
      return o <= ms && (!c || new Date(c).getTime() > ms)
    }).length
  const now = at.getTime()
  return compare(openAt(now), openAt(now - days * DAY))
}

/* -------------------------------------------------------------------------- */
/* Service management KPIs                                                     */
/* -------------------------------------------------------------------------- */

const closedStates = new Set(["Resolved", "Closed", "Canceled"])

/** Open incidents now vs `days` ago (dashboard and incidents list delta). */
export function openIncidentDelta(days = 14) {
  return openCountDelta(
    incidents,
    (i) => i.opened,
    (i) => (closedStates.has(i.state) ? (i.resolved ?? i.updated) : undefined),
    days
  )
}

/**
 * SLA compliance (percent of resolved incidents that met their SLA) for the
 * last `days` versus the `days` before.
 */
export function slaComplianceDelta(days = 14) {
  const end = NOW.getTime()
  const mid = end - days * DAY
  const start = mid - days * DAY
  const pct = (fromMs: number, toMs: number) => {
    const rows = incidents.filter(
      (i) => i.resolved && inWindow(i.resolved, fromMs, toMs)
    )
    if (!rows.length) return 0
    return (
      Math.round(
        (rows.filter((i) => !i.slaBreached).length / rows.length) * 1000
      ) / 10
    )
  }
  return compare(pct(mid, end), pct(start, mid))
}

/** Mean time to resolve, in hours, over resolved incidents in the last `days`. */
export function meanTimeToResolveHours(days = 30) {
  const since = NOW.getTime() - days * DAY
  const rows = incidents.filter(
    (i) => i.resolved && new Date(i.resolved).getTime() >= since
  )
  const hours = rows.map(
    (i) =>
      (new Date(i.resolved as string).getTime() -
        new Date(i.opened).getTime()) /
      3_600_000
  )
  return Math.round(mean(hours) * 10) / 10
}

/** Open alerts now vs `days` ago. */
export function openAlertDelta(days = 14) {
  return openCountDelta(
    alerts,
    (a) => a.opened,
    (a) => (a.state === "Closed" ? a.updated : undefined),
    days
  )
}

/** Spend on fulfilled requests in the last `days` vs the `days` before. */
export function fulfilledRequestSpendDelta(days = 30) {
  return sumInWindows(
    requests.filter((r) => r.state === "Closed Complete"),
    (r) => r.updated,
    (r) => r.price,
    days
  )
}

/** Approvals requested in the last `days` vs the `days` before. */
export function approvalsRequestedDelta(days = 7) {
  return countInWindows(approvals, (a) => a.requested, days)
}
