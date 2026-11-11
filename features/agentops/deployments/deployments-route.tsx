"use client"

import { useSearchParams } from "next/navigation"

import { getDeployedAgent } from "@/lib/data/agentops"
import { DeploymentsView } from "./deployments-view"
import { isDeploymentsTab } from "./tabs"

/**
 * Client entry for /agentops/deployments. Reads `?tab=` and `?agent=`
 * through `useSearchParams` (the page wraps it in `<Suspense>` with the table
 * skeleton) so the server page stays static. Unknown agents are ignored.
 */
export function DeploymentsRoute() {
  const params = useSearchParams()
  const tab = params.get("tab") ?? undefined
  const agent = params.get("agent")
  const agentId = agent && getDeployedAgent(agent) ? agent : undefined

  return (
    <DeploymentsView
      tab={isDeploymentsTab(tab) ? tab : "releases"}
      agentId={agentId}
    />
  )
}
