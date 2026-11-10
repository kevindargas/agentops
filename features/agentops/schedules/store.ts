import {
  scheduledRuns,
  schedules,
  triggers,
  type RunSource,
  type ScheduledRun,
} from "@/lib/data/schedules"
import { clock } from "@/lib/data/seed"
import { createListStore } from "@/lib/store"

/**
 * Module-scope client state for the Schedules & Triggers page. The tables,
 * the stat cards, the tab counts and the calendar all read the same lists,
 * so pausing a schedule or queuing a run moves every number on the page.
 * Not persisted: a reload returns to the seed.
 */
export const scheduleStore = createListStore(schedules, (s) => s.id)
export const triggerStore = createListStore(triggers, (t) => t.id)
export const runStore = createListStore(scheduledRuns, (r) => r.id)

let seq = 0

/** Deterministic id for records created in the browser session. */
export function nextLocalId(prefix: "sch" | "trg" | "run" | "dlv") {
  seq += 1
  return `${prefix}-local-${String(seq).padStart(3, "0")}`
}

/**
 * Append a Running run to the history for a schedule or trigger. Returns the
 * run so callers can name it in the toast.
 */
export function queueRun(input: {
  source: RunSource
  sourceId: string
  sourceName: string
  agentId: string
}): ScheduledRun {
  const run: ScheduledRun = {
    id: nextLocalId("run"),
    source: input.source,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    agentId: input.agentId,
    startedAt: clock().toISOString(),
    durationMs: 0,
    status: "Running",
    itemsProcessed: 0,
    cost: 0,
  }
  runStore.add(run, "start")
  return run
}
