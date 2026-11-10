import { describe, expect, it } from "vitest"

import { NOW } from "@/lib/data/seed"
import {
  fmtDuration,
  fmtRunDuration,
  formatBytes,
  formatCost,
  formatDelta,
  formatDurationMs,
  formatMs,
  formatNumber,
  formatPercent,
  formatTokens,
  timeAgo,
} from "@/lib/format"

describe("timeAgo", () => {
  it("is relative to the fixed demo clock so SSR and CSR agree", () => {
    const twoHoursAgo = new Date(
      NOW.getTime() - 2 * 60 * 60 * 1000
    ).toISOString()
    expect(timeAgo(twoHoursAgo)).toMatch(/2 hours ago/)
  })
})

describe("number formatting", () => {
  it("formats compact numbers", () => {
    expect(formatNumber(1234)).toBe("1,234")
    expect(formatNumber(12_500, true)).toMatch(/12\.5K|13K/)
  })
  it("formats percentages and deltas", () => {
    expect(formatPercent(68.95)).toBe("69.0%")
    expect(formatDelta(2.1)).toMatch(/^\+2\.1%$/)
    expect(formatDelta(-8, "%", 0)).toMatch(/^[-−]8%$/)
  })
  it("formats bytes", () => {
    expect(formatBytes(1536)).toMatch(/1\.5 KB/)
  })
})

describe("duration and latency", () => {
  it("formats milliseconds across second, minute, hour and day boundaries", () => {
    expect(formatDurationMs(0)).toBe("0s")
    expect(formatDurationMs(48_000)).toBe("48s")
    expect(formatDurationMs(252_000)).toBe("4m 12s")
    expect(formatDurationMs(240_000)).toBe("4m")
    expect(formatDurationMs(3_900_000)).toBe("1h 05m")
    expect(formatDurationMs(93_600_000)).toBe("1d 2h")
  })
  it("formats latency and tokens", () => {
    expect(formatMs(0)).toBe("0 ms")
    expect(formatMs(320)).toBe("320 ms")
    expect(formatMs(1_400)).toBe("1.4 s")
    expect(formatMs(12_000)).toBe("12 s")
    expect(formatTokens(840)).toBe("840")
    expect(formatTokens(1_250)).toBe("1.3K")
    expect(formatTokens(70_100_000)).toBe("70.1M")
    expect(formatCost(0)).toBe("$0")
    expect(formatCost(0.0042)).toBe("$0.0042")
    expect(formatCost(12.4)).toBe("$12.40")
  })
  it("keeps the short aliases pointing at the same implementation", () => {
    expect(fmtDuration).toBe(formatDurationMs)
    expect(fmtRunDuration).toBe(formatDurationMs)
  })
})
