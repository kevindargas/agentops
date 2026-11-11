"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { getDeployedAgent } from "@/lib/data/agentops"

function ScopedTitle({ base }: { base: string }) {
  const params = useSearchParams()
  const agentId = params.get("agent")
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return <>{agent ? `${base} · ${agent.name}` : base}</>
}

/**
 * Page title that appends the scoped agent's name when `?agent=<agt-id>` is in
 * the URL ("Review Queue · Support Triage"). Reads the URL on the client so the
 * server page stays static; renders the base title until the params resolve.
 */
export function AgentScopedTitle({ base }: { base: string }) {
  return (
    <Suspense fallback={base}>
      <ScopedTitle base={base} />
    </Suspense>
  )
}
