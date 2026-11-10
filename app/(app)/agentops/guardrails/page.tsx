import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { GuardrailsView } from "@/features/agentops/guardrails/guardrails-view"
import { isGuardrailsTab } from "@/features/agentops/guardrails/tabs"
import { NewPolicyButton } from "@/features/agentops/guardrails/new-policy-button"
import { getGuardrail } from "@/lib/data/guardrails"

export const metadata: Metadata = { title: "Guardrails" }

export default async function GuardrailsPage({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string; tab?: string; byPolicy?: string }>
}) {
  const { policy, tab, byPolicy } = await searchParams
  const initialTab = isGuardrailsTab(tab) ? tab : "policies"
  const violationPolicy =
    byPolicy && getGuardrail(byPolicy) ? byPolicy : undefined
  return (
    <>
      <PageHeader
        nav="/agentops/guardrails"
        description="Policies that bound what agents may read, say and do. Each one is versioned as code and scoped per agent, and every trigger links back to the trace it fired on."
        actions={<NewPolicyButton />}
      />
      <GuardrailsView
        key={`${policy ?? ""}:${initialTab}:${violationPolicy ?? ""}`}
        initialPolicyId={policy}
        initialTab={initialTab}
        initialViolationPolicyId={
          initialTab === "violations" ? violationPolicy : undefined
        }
      />
    </>
  )
}
