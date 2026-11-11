import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { DeploymentsRoute } from "@/features/agentops/deployments/deployments-route"

export const metadata: Metadata = { title: "Deployments" }

/**
 * Static shell. `?tab=` and `?agent=` are read on the client by
 * `DeploymentsRoute` inside the Suspense boundary, so this page never touches
 * `searchParams` and can be exported statically.
 */
export default function DeploymentsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/deployments"
        description="Every prompt, model, tool or parameter change ships as a release with an eval gate, approvals and a staged rollout. Promote when the canary holds, roll back in one click when it does not."
      />
      <Suspense fallback={<TableSkeleton />}>
        <DeploymentsRoute />
      </Suspense>
    </>
  )
}
