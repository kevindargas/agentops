import { describe, expect, it } from "vitest"

import {
  describeCron,
  nextRun,
  occurrences,
  scheduledRuns,
  schedules,
  triggers,
} from "@/lib/data/schedules"
import { NOW } from "@/lib/data/seed"

describe("describeCron", () => {
  it.each([
    ["*/15 * * * *", "Every 15 minutes"],
    ["0 * * * *", "Every hour"],
    ["0 */6 * * *", "Every 6 hours"],
    ["0 2 * * *", "Every day at 02:00"],
    ["30 5 * * *", "Every day at 05:30"],
    ["0 9,15 * * 1-5", "Weekdays at 09:00 and 15:00"],
    ["0 7 * * 1", "Every Monday at 07:00"],
    ["0 8 * * 1,4", "Every Monday and Thursday at 08:00"],
    ["0 3 * * 0", "Every Sunday at 03:00"],
    ["0 6 1 * *", "On the 1st of every month at 06:00"],
    ["0 0 * * 6,0", "Weekends at 00:00"],
  ])("%s → %s", (expr, text) => {
    expect(describeCron(expr)).toBe(text)
  })

  it("falls back to the raw expression for unsupported patterns", () => {
    expect(describeCron("not a cron")).toBe("not a cron")
    expect(describeCron("5 4 * 2 *")).toBe("5 4 * 2 *")
  })
})

describe("nextRun", () => {
  // NOW is Thursday 2026-11-05T14:30:00Z.
  it("finds the next daily run after the demo clock", () => {
    expect(nextRun("0 2 * * *")).toBe("2026-11-06T02:00:00.000Z")
  })

  it("handles minute steps", () => {
    expect(nextRun("*/15 * * * *")).toBe("2026-11-05T14:45:00.000Z")
  })

  it("is strictly after `from`", () => {
    const at = new Date("2026-11-05T15:00:00Z")
    expect(nextRun("0 * * * *", at)).toBe("2026-11-05T16:00:00.000Z")
  })

  it("respects fixed timezone offsets", () => {
    // 09:00/15:00 New York (UTC−5) on weekdays → 15:00 local = 20:00Z today.
    expect(nextRun("0 9,15 * * 1-5", NOW, "America/New_York")).toBe(
      "2026-11-05T20:00:00.000Z"
    )
    // Monday 07:00 Berlin (UTC+1) → Mon 9 Nov 06:00Z.
    expect(nextRun("0 7 * * 1", NOW, "Europe/Berlin")).toBe(
      "2026-11-09T06:00:00.000Z"
    )
  })

  it("rolls over months for day-of-month schedules", () => {
    expect(nextRun("0 6 1 * *")).toBe("2026-12-01T06:00:00.000Z")
  })

  it("lists occurrences inside a window", () => {
    const start = new Date("2026-11-02T00:00:00Z")
    const end = new Date("2026-11-09T00:00:00Z")
    expect(occurrences("0 2 * * *", start, end)).toHaveLength(7)
    expect(occurrences("0 9,15 * * 1-5", start, end)).toHaveLength(10)
    expect(occurrences("*/15 * * * *", start, end, "UTC", 50)).toHaveLength(50)
  })
})

describe("mock data", () => {
  it("is deterministic and well-formed", () => {
    expect(schedules.length).toBeGreaterThanOrEqual(14)
    expect(triggers.length).toBeGreaterThanOrEqual(10)
    expect(scheduledRuns.length).toBeGreaterThanOrEqual(60)
    expect(scheduledRuns.length).toBeLessThanOrEqual(100)
    for (const r of scheduledRuns) {
      expect(new Date(r.startedAt).getTime()).toBeLessThanOrEqual(NOW.getTime())
      if (r.status === "Failed") expect(r.error).toBeTruthy()
    }
    expect(scheduledRuns.some((r) => r.status === "Running")).toBe(true)
  })
})
