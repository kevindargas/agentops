import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AuditView } from "@/features/agentops/audit/audit-view"
import { auditSources, type AuditSource } from "@/lib/data/audit"

export const metadata: Metadata = { title: "Audit Log" }

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; q?: string }>
}) {
  const { source, q } = await searchParams
  const initialSource = auditSources.includes(source as AuditSource)
    ? source
    : undefined
  const initialQuery = q?.trim() ? q.trim().slice(0, 80) : undefined

  return (
    <>
      <PageHeader
        nav="/agentops/audit"
        description="Append-only record of who changed what, when and under which approval: prompt promotions, guardrail edits, releases and rollbacks, review verdicts, tool permissions, budgets, memory deletions and key rotations. Every record is hash-chained to the one before it, so evidence cannot be edited or quietly dropped."
      />
      <Suspense fallback={<TableSkeleton columns={6} />}>
        <AuditView
          key={`${initialSource ?? ""}:${initialQuery ?? ""}`}
          initialSource={initialSource}
          initialQuery={initialQuery}
        />
      </Suspense>
    </>
  )
}
