import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { DeploymentsView } from "@/features/agentops/deployments/deployments-view"
import { isDeploymentsTab } from "@/features/agentops/deployments/tabs"
import { getDeployedAgent } from "@/lib/data/agentops"

export const metadata: Metadata = { title: "Deployments" }

export default async function DeploymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; agent?: string }>
}) {
  const { tab, agent } = await searchParams
  const initialTab = isDeploymentsTab(tab) ? tab : "releases"
  const agentId = agent && getDeployedAgent(agent) ? agent : undefined

  return (
    <>
      <PageHeader
        nav="/agentops/deployments"
        description="Every prompt, model, tool or parameter change ships as a release with an eval gate, approvals and a staged rollout. Promote when the canary holds, roll back in one click when it does not."
      />
      <DeploymentsView
        key={`${initialTab}:${agentId ?? ""}`}
        initialTab={initialTab}
        agentId={agentId}
      />
    </>
  )
}
