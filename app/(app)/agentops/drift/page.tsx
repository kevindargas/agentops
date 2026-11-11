import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AgentScopedTitle } from "@/features/agentops/agent-scoped-title"
import { DriftView } from "@/features/agentops/drift-view"

export const metadata: Metadata = { title: "Drift & Quality" }

export default function DriftPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/drift"
        title={<AgentScopedTitle base="Drift & Quality" />}
        description="Input distribution, output behaviour, evaluator quality, tool reliability and cost, each compared with the agent's trailing baseline. Signals explain what moved and link straight to traces and experiments."
      />
      <Suspense fallback={<TableSkeleton toolbar={false} />}>
        <DriftView />
      </Suspense>
    </>
  )
}
