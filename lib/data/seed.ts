/**
 * Deterministic pseudo-random helpers so server and client render identical data.
 * All mock dates are anchored to NOW so relative times stay meaningful.
 */

export const NOW = new Date("2026-11-05T14:30:00Z")

export function createRng(seed: number) {
  let s = seed >>> 0
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

export function weighted<T>(rng: Rng, items: readonly [T, number][]): T {
  const total = items.reduce((acc, [, w]) => acc + w, 0)
  let r = rng() * total
  for (const [item, w] of items) {
    r -= w
    if (r <= 0) return item
  }
  return items[items.length - 1][0]
}

export function int(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function chance(rng: Rng, p: number) {
  return rng() < p
}

export function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString()
}

export function daysAgo(days: number) {
  return hoursAgo(days * 24)
}

export function hoursFromNow(hours: number) {
  return new Date(NOW.getTime() + hours * 3_600_000).toISOString()
}

export function daysFromNow(days: number) {
  return hoursFromNow(days * 24)
}

export function pad(n: number, width = 7) {
  return String(n).padStart(width, "0")
}
