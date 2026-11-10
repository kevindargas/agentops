/**
 * Minimal line-level diff built on a longest-common-subsequence table. Good
 * enough for prompt templates (tens to a few hundred lines); no external deps.
 */

export type DiffOpType = "equal" | "add" | "remove"

export interface DiffOp {
  type: DiffOpType
  line: string
  /** 1-based line number in the "before" text (equal / remove). */
  a?: number
  /** 1-based line number in the "after" text (equal / add). */
  b?: number
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export interface SideBySideRow {
  left?: { n: number; line: string; type: "equal" | "remove" }
  right?: { n: number; line: string; type: "equal" | "add" }
}

export function splitLines(text: string): string[] {
  if (text === "") return []
  return text.replace(/\r\n/g, "\n").split("\n")
}

/** Line-level diff of `before` → `after`. */
export function diffLines(before: string, after: string): DiffOp[] {
  const a = splitLines(before)
  const b = splitLines(after)
  const n = a.length
  const m = b.length

  // lcs[i][j] = length of LCS of a[i..] and b[j..]
  const lcs: Uint32Array[] = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1)
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i], a: i + 1, b: j + 1 })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "remove", line: a[i], a: i + 1 })
      i++
    } else {
      ops.push({ type: "add", line: b[j], b: j + 1 })
      j++
    }
  }
  while (i < n) ops.push({ type: "remove", line: a[i], a: ++i })
  while (j < m) ops.push({ type: "add", line: b[j], b: ++j })
  return ops
}

export function diffStats(ops: DiffOp[]): DiffStats {
  const s: DiffStats = { added: 0, removed: 0, unchanged: 0 }
  for (const op of ops) {
    if (op.type === "add") s.added++
    else if (op.type === "remove") s.removed++
    else s.unchanged++
  }
  return s
}

/**
 * Pairs removed and added runs so they sit next to each other in a two-column
 * view. Unpaired lines leave the opposite cell empty.
 */
export function toSideBySide(ops: DiffOp[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let k = 0
  while (k < ops.length) {
    const op = ops[k]
    if (op.type === "equal") {
      rows.push({
        left: { n: op.a!, line: op.line, type: "equal" },
        right: { n: op.b!, line: op.line, type: "equal" },
      })
      k++
      continue
    }
    const removed: DiffOp[] = []
    const added: DiffOp[] = []
    while (k < ops.length && ops[k].type !== "equal") {
      if (ops[k].type === "remove") removed.push(ops[k])
      else added.push(ops[k])
      k++
    }
    const len = Math.max(removed.length, added.length)
    for (let r = 0; r < len; r++) {
      const l = removed[r]
      const rt = added[r]
      rows.push({
        left: l ? { n: l.a!, line: l.line, type: "remove" } : undefined,
        right: rt ? { n: rt.b!, line: rt.line, type: "add" } : undefined,
      })
    }
  }
  return rows
}
