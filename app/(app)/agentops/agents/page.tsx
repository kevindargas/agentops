import { Suspense } from "react"
import type { Metadata } from "next"

import { TableSkeleton } from "@/components/shared/skeletons"
import { PageHeader } from "@/components/shared/page-header"
import { AgentStats, AgentsTable } from "@/features/agentops/agents-table"
import { RegisterAgentButton } from "@/features/agentops/register-agent-button"

export const metadata: Metadata = { title: "Agents" }

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/agents"
        description="Deployed agents with their graph, model, tools, owner and current health. Open an agent for versions, traces, evals, recommendations and configuration."
        actions={<RegisterAgentButton />}
      />
      <AgentStats />
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <AgentsTable />
      </Suspense>
    </>
  )
}
