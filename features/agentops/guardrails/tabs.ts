export type GuardrailsTab = "policies" | "violations" | "coverage" | "test"

export const guardrailsTabs: GuardrailsTab[] = [
  "policies",
  "violations",
  "coverage",
  "test",
]

export function isGuardrailsTab(v: string | undefined): v is GuardrailsTab {
  return guardrailsTabs.includes(v as GuardrailsTab)
}
