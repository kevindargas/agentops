/**
 * Pure formatting helpers for Agent Operations. Kept free of "use client" so
 * server components (pages) can call them; `shared.tsx` re-exports them.
 */

export function fmtMs(ms: number) {
  if (!ms) return "—"
  return ms < 1000
    ? `${Math.round(ms)} ms`
    : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}

export function fmtCost(usd: number, digits = 2) {
  if (usd === 0) return "$0"
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(digits)}`
}

export function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return String(n)
}

/** "anthropic/claude-sonnet-5.5" → "Claude Sonnet 5.5" */
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
