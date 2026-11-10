import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { RecommendationsList } from "@/features/agentops/recommendations-list"
import { getDeployedAgent } from "@/lib/data/agentops"

export const metadata: Metadata = { title: "Recommendations" }

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; rec?: string; agent?: string }>
}) {
  const { open: openParam, rec, agent: agentId } = await searchParams
  const open = openParam ?? rec
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return (
    <>
      <PageHeader
        nav="/agentops/recommendations"
        title={agent ? `Recommendations · ${agent.name}` : undefined}
        description="Model and configuration changes generated from shadow evaluations, running experiments, cost telemetry and provider deprecation notices. Each one shows the evidence, so a human decides what ships."
      />
      <RecommendationsList
        key={`${open ?? ""}:${agent?.id ?? ""}`}
        agentId={agent?.id}
        highlightId={open}
      />
    </>
  )
}
