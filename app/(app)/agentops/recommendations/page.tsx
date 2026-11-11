import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AgentScopedTitle } from "@/features/agentops/agent-scoped-title"
import { RecommendationsView } from "@/features/agentops/recommendations-view"

export const metadata: Metadata = { title: "Recommendations" }

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/recommendations"
        title={<AgentScopedTitle base="Recommendations" />}
        description="Model and configuration changes generated from shadow evaluations, running experiments, cost telemetry and provider deprecation notices. Each one shows the evidence, so a human decides what ships."
      />
      <Suspense fallback={<TableSkeleton toolbar={false} />}>
        <RecommendationsView />
      </Suspense>
    </>
  )
}
