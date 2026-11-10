import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { DriftBoard } from "@/features/agentops/drift-board"
import { getDeployedAgent } from "@/lib/data/agentops"

export const metadata: Metadata = { title: "Drift & Quality" }

export default async function DriftPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; state?: string }>
}) {
  const { agent: agentId, state } = await searchParams
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return (
    <>
      <PageHeader
        nav="/agentops/drift"
        title={agent ? `Drift & Quality · ${agent.name}` : undefined}
        description="Input distribution, output behaviour, evaluator quality, tool reliability and cost, each compared with the agent's trailing baseline. Signals explain what moved and link straight to traces and experiments."
      />
      <DriftBoard
        key={`${agent?.id ?? ""}:${state ?? ""}`}
        initialAgentId={agent?.id}
        initialState={state}
      />
    </>
  )
}
