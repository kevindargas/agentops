import { describe, expect, it } from "vitest"

import { diffLines, diffStats, splitLines, toSideBySide } from "./diff"

describe("diffLines", () => {
  it("returns only equal ops for identical input", () => {
    const ops = diffLines("a\nb\nc", "a\nb\nc")
    expect(ops.map((o) => o.type)).toEqual(["equal", "equal", "equal"])
    expect(diffStats(ops)).toEqual({ added: 0, removed: 0, unchanged: 3 })
  })

  it("detects an inserted line and keeps line numbers", () => {
    const ops = diffLines("a\nc", "a\nb\nc")
    expect(ops).toEqual([
      { type: "equal", line: "a", a: 1, b: 1 },
      { type: "add", line: "b", b: 2 },
      { type: "equal", line: "c", a: 2, b: 3 },
    ])
  })

  it("detects removals and replacements", () => {
    const ops = diffLines("a\nb\nc\nd", "a\nx\nd")
    expect(diffStats(ops)).toEqual({ added: 1, removed: 2, unchanged: 2 })
    expect(ops.filter((o) => o.type === "remove").map((o) => o.line)).toEqual([
      "b",
      "c",
    ])
    expect(ops.filter((o) => o.type === "add").map((o) => o.line)).toEqual([
      "x",
    ])
  })

  it("handles empty sides", () => {
    expect(splitLines("")).toEqual([])
    expect(diffLines("", "a\nb").map((o) => o.type)).toEqual(["add", "add"])
    expect(diffLines("a\nb", "").map((o) => o.type)).toEqual([
      "remove",
      "remove",
    ])
  })

  it("preserves order so the after side reconstructs the new text", () => {
    const before = "system\nrules\n- one\n- two\nend"
    const after = "system\nrules\n- one\n- two (revised)\n- three\nend"
    const ops = diffLines(before, after)
    const rebuilt = ops
      .filter((o) => o.type !== "remove")
      .map((o) => o.line)
      .join("\n")
    expect(rebuilt).toBe(after)
  })
})

describe("toSideBySide", () => {
  it("pairs a replacement on one row", () => {
    const rows = toSideBySide(diffLines("a\nb\nc", "a\nB\nc"))
    expect(rows).toHaveLength(3)
    expect(rows[1].left).toMatchObject({ line: "b", type: "remove", n: 2 })
    expect(rows[1].right).toMatchObject({ line: "B", type: "add", n: 2 })
  })

  it("leaves the opposite cell empty for unpaired lines", () => {
    const rows = toSideBySide(diffLines("a", "a\nb\nc"))
    expect(rows[1].left).toBeUndefined()
    expect(rows[2].right?.line).toBe("c")
  })
})
