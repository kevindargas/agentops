import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { ExperimentStats } from "@/features/agentops/experiments"
import { ExperimentsView } from "@/features/agentops/experiments-view"

export const metadata: Metadata = { title: "Experiments" }

export default function ExperimentsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/experiments"
        description="A/B tests on models, prompts, retrieval and tooling. Traffic is split per session, the primary metric is tracked daily, and a variant can be promoted once it clears 95% confidence."
      />
      <ExperimentStats />
      <Suspense fallback={<TableSkeleton />}>
        <ExperimentsView />
      </Suspense>
    </>
  )
}
