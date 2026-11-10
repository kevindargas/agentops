import { describe, expect, it } from "vitest"

import { NOW } from "@/lib/data/seed"
import {
  formatBytes,
  formatDelta,
  formatNumber,
  formatPercent,
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
