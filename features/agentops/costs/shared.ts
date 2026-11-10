import type { MeterTone } from "@/components/charts/availability-bar"
import { formatCurrency } from "@/lib/format"
import type { Budget } from "@/lib/data/costs"
import { NOW } from "@/lib/data/seed"

/** Currency with cents for amounts under $1K, whole dollars above. */
export function fmtUsd(n: number) {
  if (Math.abs(n) >= 1000) return formatCurrency(n)
  if (Math.abs(n) < 0.01 && n !== 0) return `$${n.toFixed(4)}`
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Per-request costs are fractions of a cent; show 3–4 significant digits. */
export function fmtPerRequest(n: number) {
  if (n === 0) return "$0"
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

export function budgetPct(b: Budget) {
  return b.limit ? (b.spent / b.limit) * 100 : 0
}

/** Bar tone driven by the budget's own thresholds. */
export function budgetTone(b: Budget): MeterTone {
  const pct = budgetPct(b)
  if (pct >= 100) return "danger"
  const warn = b.thresholds.filter((t) => t < 100).pop() ?? 80
  if (pct >= warn) return "warning"
  if (b.status === "At risk") return "warning"
  return "brand"
}

/** Expected share of the period elapsed on the demo clock, 0–100. */
export function periodPace(period: Budget["period"]) {
  const minutes = NOW.getUTCHours() * 60 + NOW.getUTCMinutes()
  if (period === "daily") return (minutes / (24 * 60)) * 100
  const daysInMonth = new Date(
    Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 0)
  ).getUTCDate()
  return ((NOW.getUTCDate() - 1 + minutes / (24 * 60)) / daysInMonth) * 100
}

export function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n")
}

/** Client-side download of a text blob. */
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv"
) {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
