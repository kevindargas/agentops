/**
 * Pure formatting helpers for schedules. Free of "use client" so server
 * components (pages) can use them; `shared.tsx` re-exports them.
 */

/** Milliseconds → "48s", "4m 12s", "1h 05m". */
export function fmtRunDuration(ms: number) {
  if (ms <= 0) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return rs ? `${m}m ${String(rs).padStart(2, "0")}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${String(rm).padStart(2, "0")}m` : `${h}h`
}

export function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
}

/** "in 2h 15m" / "in 3d" style countdown anchored to the demo clock. */
export function fmtUntil(iso: string, from: Date) {
  const ms = new Date(iso).getTime() - from.getTime()
  if (ms <= 0) return "now"
  const m = Math.round(ms / 60_000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `in ${h}h ${m % 60}m` : `in ${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `in ${d}d ${h % 24}h` : `in ${d}d`
}
