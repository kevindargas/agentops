/**
 * Pure helpers for the evals feature; no "use client" so server pages can use
 * them. `shared.tsx` re-exports them for client code.
 */
import type { EvaluatorScale } from "@/lib/data/evals"

export { fmtCost, fmtMs } from "@/features/agentops/format"

/** Normalised 0–1 score rendered on the evaluator's own scale. */
export function formatEvalScore(value: number, scale: EvaluatorScale) {
  if (scale === "pass/fail") return value >= 0.5 ? "Pass" : "Fail"
  if (scale === "1–5") return (1 + value * 4).toFixed(1)
  return value.toFixed(2)
}

/** Milliseconds → "4m 12s", "1h 03m". */
export function fmtDuration(ms: number) {
  if (!ms) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, "0")}m`
}

export const triggerHint: Record<string, string> = {
  Manual: "Started by a person from the console",
  CI: "Triggered by a pull request on the agent repo",
  Scheduled: "Nightly regression run",
  "Pre-deploy": "Required check before promoting a candidate",
}

export type EvalsTab = "runs" | "datasets" | "evaluators" | "gates"
const tabValues: EvalsTab[] = ["runs", "datasets", "evaluators", "gates"]

export function isEvalsTab(v: string | undefined): v is EvalsTab {
  return tabValues.includes(v as EvalsTab)
}
