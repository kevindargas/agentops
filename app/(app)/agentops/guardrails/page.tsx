import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { GuardrailsRoute } from "@/features/agentops/guardrails/guardrails-route"
import { NewPolicyButton } from "@/features/agentops/guardrails/new-policy-button"

export const metadata: Metadata = { title: "Guardrails" }

/**
 * Static shell. `?tab=`, `?policy=` and `?byPolicy=` are read on the client
 * by `GuardrailsRoute` inside the Suspense boundary, so this page never
 * touches `searchParams` and can be exported statically.
 */
export default function GuardrailsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/guardrails"
        description="Policies that bound what agents may read, say and do. Each one is versioned as code and scoped per agent, and every trigger links back to the trace it fired on."
        actions={<NewPolicyButton />}
      />
      <Suspense fallback={<TableSkeleton />}>
        <GuardrailsRoute />
      </Suspense>
    </>
  )
}
