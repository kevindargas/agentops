import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { ReviewQueue, ReviewStats } from "@/features/agentops/review-queue"
import { getDeployedAgent } from "@/lib/data/agentops"

export const metadata: Metadata = { title: "Review Queue" }

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; agent?: string }>
}) {
  const { item, agent: agentId } = await searchParams
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return (
    <>
      <PageHeader
        nav="/agentops/reviews"
        title={agent ? `Review Queue · ${agent.name}` : undefined}
        description="Humans in the loop. Answers sampled by evaluator flags, negative feedback, policy matches or random draw wait here for a verdict. Approvals, corrections and flags are recorded on the item with your rubric and note; in a wired deployment they feed the eval set and the agent owner."
      />
      <ReviewStats />
      <ReviewQueue
        key={`${item ?? ""}:${agent?.id ?? ""}`}
        initialSelectedId={item}
        agentId={agent?.id}
      />
    </>
  )
}
