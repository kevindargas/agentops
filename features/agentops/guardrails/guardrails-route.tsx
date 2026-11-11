"use client"

import { useSearchParams } from "next/navigation"

import { getGuardrail } from "@/lib/data/guardrails"
import { GuardrailsView } from "./guardrails-view"
import { isGuardrailsTab } from "./tabs"

/**
 * Client entry for /agentops/guardrails. Reads `?tab=`, `?policy=` and
 * `?byPolicy=` through `useSearchParams` (the page wraps it in `<Suspense>`
 * with the table skeleton) so the server page stays static and the route can
 * be exported. `?byPolicy=` only applies on the Violations tab and must name
 * a known policy.
 */
export function GuardrailsRoute() {
  const params = useSearchParams()
  const tab = params.get("tab") ?? undefined
  const policy = params.get("policy") ?? undefined
  const byPolicy = params.get("byPolicy") ?? undefined
  const activeTab = isGuardrailsTab(tab) ? tab : "policies"
  const violationPolicy =
    byPolicy && getGuardrail(byPolicy) ? byPolicy : undefined

  return (
    <GuardrailsView
      policyId={policy}
      tab={activeTab}
      violationPolicyId={
        activeTab === "violations" ? violationPolicy : undefined
      }
    />
  )
}
