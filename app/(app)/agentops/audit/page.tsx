import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AuditRoute } from "@/features/agentops/audit/audit-route"

export const metadata: Metadata = { title: "Audit Log" }

/**
 * Static shell. `?source=`, `?q=`, `?event=` and `?range=` are read on the
 * client inside the Suspense boundary, so this page never touches
 * `searchParams` and can be exported statically.
 */
export default function AuditPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/audit"
        description="Append-only record of who changed what, when and under which approval: prompt promotions, guardrail edits, releases and rollbacks, review verdicts, tool permissions, budgets, memory deletions and key rotations. Every record is hash-chained to the one before it, so evidence cannot be edited or quietly dropped."
      />
      <Suspense fallback={<TableSkeleton columns={6} />}>
        <AuditRoute />
      </Suspense>
    </>
  )
}
