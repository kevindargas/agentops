import { NOW } from "@/lib/data/seed"

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

export function formatCurrency(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(n)
}

export function formatNumber(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n)
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

/** Hours → "45m", "4h", "4h 20m", "3d 2h". Negative values are clamped to 0. */
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

/** Bytes → "1.2 GB" with sensible precision. */
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
