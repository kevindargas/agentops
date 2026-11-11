/** Date-range presets shared by the analytics view (resolving ?period=) and the client selector. */
export const periodOptions = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
] as const

export type PeriodValue = (typeof periodOptions)[number]["value"]
export type PeriodOption = (typeof periodOptions)[number]

export function resolvePeriod(
  raw: string | string[] | undefined,
  fallback: PeriodValue = "90d"
): PeriodOption {
  const v = Array.isArray(raw) ? raw[0] : raw
  return (
    periodOptions.find((p) => p.value === v) ??
    periodOptions.find((p) => p.value === fallback)!
  )
}
