import {
  falsePositiveRate,
  guardrails,
  guardrailStats,
  guardrailViolations,
  type Guardrail,
  type GuardrailViolation,
} from "@/lib/data/guardrails"
import { createListStore } from "@/lib/store"

/**
 * Module-scoped stores so the stat cards, the policies table, the violations
 * table, the coverage matrix and the policy sheet all render from one list.
 * Disabling a policy or deciding a verdict moves every number on the page.
 */
export const policyStore = createListStore(guardrails, (g) => g.id)
export const violationStore = createListStore(guardrailViolations, (v) => v.id)

/** The single false-positive definition lives in `lib/data/guardrails.ts`. */
export { falsePositiveRate }

/** Amber at 15%, red at 30%; shared by the card, the column and the sheet. */
export const fpThresholds = { warning: 0.15, danger: 0.3 } as const

export function fpTone(rate: number | null): "warning" | "danger" | undefined {
  if (rate === null) return undefined
  if (rate >= fpThresholds.danger) return "danger"
  if (rate >= fpThresholds.warning) return "warning"
  return undefined
}

/** Fleet stats from the client lists; same computation as `guardrailStats`. */
export function computeGuardrailStats(
  policies: Guardrail[],
  violations: GuardrailViolation[]
) {
  return guardrailStats(policies, violations)
}
