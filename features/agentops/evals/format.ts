/**
 * Pure helpers for the evals feature; no "use client" so server pages can use
 * them. Money, latency and duration formatters live in `@/lib/format`.
 */
import type { EvaluatorScale } from "@/lib/data/evals"

/** Normalised 0 to 1 score rendered on the evaluator's own scale. */
export function formatEvalScore(value: number, scale: EvaluatorScale) {
  if (scale === "pass/fail") return value >= 0.5 ? "Pass" : "Fail"
  if (scale === "1-5") return (1 + value * 4).toFixed(1)
  return value.toFixed(2)
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
