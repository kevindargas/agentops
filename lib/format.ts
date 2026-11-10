import { siteConfig } from "@/config/site"
import { NOW } from "@/lib/data/seed"

const { locale, currency, timeZone } = siteConfig

const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

/** Relative time anchored to the demo clock so SSR and CSR agree. */
export function timeAgo(iso: string, base: Date = NOW) {
  const diffMs = new Date(iso).getTime() - base.getTime()
  const abs = Math.abs(diffMs)
  const minutes = Math.round(diffMs / 60_000)
  if (abs < 60_000) return "just now"
  if (abs < 3_600_000) return rtf.format(minutes, "minute")
  const hours = Math.round(diffMs / 3_600_000)
  if (abs < 86_400_000) return rtf.format(hours, "hour")
  const days = Math.round(diffMs / 86_400_000)
  if (abs < 30 * 86_400_000) return rtf.format(days, "day")
  const months = Math.round(days / 30)
  return rtf.format(months, "month")
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
    ...opts,
  })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
}

/** Time of day only, 24-hour clock: "09:15". */
export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  })
}

export function formatCurrency(n: number, compact = false) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(n)
}

/**
 * Small-money formatter for per-run and per-token costs: "$0", "$0.0042",
 * "$12.40". Use `formatCurrency` for budgets and totals.
 */
export function formatCost(usd: number, digits = 2) {
  if (usd === 0) return "$0"
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(digits)}`
}

export function formatNumber(n: number, compact = false) {
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n)
}

/** Token counts: 840, 1.2K, 48K, 70.1M. */
export function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return String(n)
}

export function formatPercent(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`
}

/** Signed delta with a unit, e.g. +12%, −3.5pt. Uses a true minus sign. */
export function formatDelta(delta: number, unit = "%", digits = 1) {
  const abs = Math.abs(delta)
  const n = Number.isInteger(abs) ? abs.toString() : abs.toFixed(digits)
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${n}${unit}`
}

/** Latency: "0 ms", "320 ms", "1.4 s", "12 s". */
export function formatMs(ms: number) {
  if (!ms) return "0 ms"
  return ms < 1000
    ? `${Math.round(ms)} ms`
    : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}

/**
 * Elapsed time from milliseconds: "0s", "48s", "4m 12s", "1h 05m", "2d 3h".
 * The single duration formatter for runs, eval jobs and schedules.
 */
export function formatDurationMs(ms: number) {
  if (ms <= 0) return "0s"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return rs ? `${m}m ${String(rs).padStart(2, "0")}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (h < 24) return rm ? `${h}h ${String(rm).padStart(2, "0")}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

/** Hours to "45m", "4h", "4h 20m", "3d 2h". Negative values are clamped to 0. */
export function formatDuration(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60))
  if (totalMinutes < 60) return `${totalMinutes}m`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

/** Countdown to a future instant: "now", "in 12m", "in 2h 15m", "in 3d". */
export function formatUntil(iso: string, from: Date = NOW) {
  const ms = new Date(iso).getTime() - from.getTime()
  if (ms <= 0) return "now"
  const m = Math.round(ms / 60_000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `in ${h}h ${m % 60}m` : `in ${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `in ${d}d ${h % 24}h` : `in ${d}d`
}

/** Bytes to "1.2 GB" with sensible precision. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

/** "anthropic/claude-sonnet-5.5" to "Claude Sonnet 5.5". */
export function modelDisplayName(modelId: string) {
  const tail = modelId.split("/").pop() ?? modelId
  return tail
    .replace(/:.*$/, "")
    .split("-")
    .map((part) =>
      /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ")
    .replace(/\bGpt\b/, "GPT")
    .replace(/\bPreview\b/, "")
    .trim()
}

/*
 * Short aliases kept for the Agent Operations call sites. New code should use
 * the `format*` names above.
 */
export { formatCost as fmtCost }
export { formatMs as fmtMs }
export { formatTokens as fmtTokens }
export { formatDurationMs as fmtDuration }
export { formatDurationMs as fmtRunDuration }
export { formatClock as fmtClock }
export { formatUntil as fmtUntil }
