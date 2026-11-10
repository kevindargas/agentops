import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import {
  ExperimentStats,
  ExperimentsTable,
} from "@/features/agentops/experiments"

export const metadata: Metadata = { title: "Experiments" }

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; agent?: string }>
}) {
  const { open, agent } = await searchParams
  return (
    <>
      <PageHeader
        nav="/agentops/experiments"
        description="A/B tests on models, prompts, retrieval and tooling. Traffic is split per session, the primary metric is tracked daily, and a variant can be promoted once it clears 95% confidence."
      />
      <ExperimentStats />
      <ExperimentsTable
        key={`${open ?? ""}:${agent ?? ""}`}
        initialOpenId={open}
        initialAgentFacet={agent}
        syncUrl
      />
    </>
  )
}
