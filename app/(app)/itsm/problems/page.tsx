import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { NewProblemSheet } from "@/features/problems/new-problem-sheet"
import { ProblemsTable } from "@/features/problems/problems-table"
import { incidentsForProblem, problems } from "@/lib/data/itsm"

export const metadata: Metadata = { title: "Problems" }

export default function ProblemsPage() {
  const open = problems.filter((p) => !["Resolved", "Closed"].includes(p.state))
  const knownErrors = problems.filter((p) => p.knownError).length
  const rca = problems.filter((p) => p.state === "Root Cause Analysis").length
  const linked = problems.reduce(
    (acc, p) => acc + incidentsForProblem(p.number).length,
    0
  )
  const withWorkaround = problems.filter((p) => p.workaround).length
  return (
    <>
      <PageHeader
        nav="/itsm/problems"
        description="Identify and eliminate the root cause of recurring incidents. Publish known errors and workarounds so the Service Desk can resolve faster."
        actions={
          <>
            <Button variant="outline" render={<Link href="/itsm/knowledge" />}>
              Known error articles
            </Button>
            <Suspense fallback={<Skeleton className="h-8 w-32" />}>
              <NewProblemSheet />
            </Suspense>
          </>
        }
      />
      <StatGrid columns={4}>
        <StatCard
          label="Open problems"
          value={open.length}
          hint={`${open.filter((p) => p.priority <= 2).length} high priority`}
        />
        <StatCard
          label="In root cause analysis"
          value={rca}
          hint="Actively being investigated"
        />
        <StatCard
          label="Known errors"
          value={knownErrors}
          hint={`${withWorkaround} with a documented workaround`}
        />
        <StatCard
          label="Incidents linked"
          value={linked}
          hint="Incidents that name a problem as their cause"
        />
      </StatGrid>
      <Suspense fallback={<TableSkeleton columns={7} />}>
        <ProblemsTable />
      </Suspense>
    </>
  )
}
