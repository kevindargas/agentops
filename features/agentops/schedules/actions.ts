import { toast } from "sonner"

import { getDeployedAgent } from "@/lib/data/agentops"
import { nextRun, type Schedule } from "@/lib/data/schedules"
import { NOW } from "@/lib/data/seed"
import { formatUntil } from "@/lib/format"
import { queueRun, scheduleStore } from "./store"

/* ------------------------------------------------------------------------ */
/* Shared actions                                                            */
/* ------------------------------------------------------------------------ */

/** Pause or resume a schedule in the store with an Undo toast. */
export function toggleSchedule(id: string, on: boolean) {
  const s = scheduleStore.get().find((x) => x.id === id)
  if (!s) return
  scheduleStore.patch(id, { enabled: on })
  toast(on ? "Schedule resumed" : "Schedule paused", {
    description: on
      ? `${s.name} next runs ${formatUntil(nextRun(s.cron, NOW, s.timezone))}.`
      : `${s.name} will not run until resumed.`,
    action: {
      label: "Undo",
      onClick: () => scheduleStore.patch(id, { enabled: !on }),
    },
  })
}

/**
 * Start a run outside the cadence. Appends a Running run to the history and
 * marks it as the schedule's last run. Refuses when the target agent is
 * paused, because the scheduler would not get the run accepted either.
 */
export function runScheduleNow(s: Schedule) {
  const agent = getDeployedAgent(s.agentId)
  if (agent?.paused) {
    toast.error(`${agent.name} is paused`, {
      description: `Resume the agent before running ${s.name}. No run was queued.`,
    })
    return
  }
  const run = queueRun({
    source: "schedule",
    sourceId: s.id,
    sourceName: s.name,
    agentId: s.agentId,
  })
  scheduleStore.patch(s.id, {
    lastRun: { at: run.startedAt, status: "Running", durationMs: 0 },
  })
  toast.success("Run started", {
    description: `${run.id} is Running on ${agent?.name ?? s.agentId}. It is listed under Run history.`,
  })
}
