import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  BugIcon,
  CircleDotIcon,
  LinkIcon,
  PlusIcon,
  SearchCheckIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ProblemsTable } from "@/features/problems/problems-table"
import { problems } from "@/lib/data"

export const metadata: Metadata = { title: "Problems" }

export default function ProblemsPage() {
  const open = problems.filter((p) => !["Resolved", "Closed"].includes(p.state))
  const knownErrors = problems.filter((p) => p.knownError).length
  const rca = problems.filter((p) => p.state === "Root Cause Analysis").length
  const linked = problems.reduce((acc, p) => acc + p.relatedIncidents, 0)
  const withWorkaround = problems.filter((p) => p.workaround).length
  return (
    <>
      <PageHeader
        title="Problems"
        description="Identify and eliminate the root cause of recurring incidents. Publish known errors and workarounds so the Service Desk can resolve faster."
        actions={
          <>
            <Button variant="outline" render={<Link href="/itsm/knowledge" />}>
              Known error articles
            </Button>
            <Button render={<Link href="/itsm/problems?new=1" />}>
              <PlusIcon /> New problem
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open problems"
          value={open.length}
          icon={<CircleDotIcon />}
          hint={`${open.filter((p) => p.priority <= 2).length} high priority`}
        />
        <StatCard
          label="In root cause analysis"
          value={rca}
          icon={<SearchCheckIcon />}
          hint="Actively being investigated"
        />
        <StatCard
          label="Known errors"
          value={knownErrors}
          icon={<BugIcon />}
          hint={`${withWorkaround} with a documented workaround`}
        />
        <StatCard
          label="Incidents linked"
          value={linked}
          icon={<LinkIcon />}
          hint="Across all problems"
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProblemsTable />
      </Suspense>
    </>
  )
}
