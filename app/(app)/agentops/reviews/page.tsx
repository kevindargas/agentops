import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { AgentScopedTitle } from "@/features/agentops/agent-scoped-title"
import { ReviewStats } from "@/features/agentops/review-queue"
import { ReviewQueueView } from "@/features/agentops/review-queue-view"

export const metadata: Metadata = { title: "Review Queue" }

export default function ReviewsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/reviews"
        title={<AgentScopedTitle base="Review Queue" />}
        description="Humans in the loop. Answers sampled by evaluator flags, negative feedback, policy matches or random draw wait here for a verdict. Approvals, corrections and flags are recorded on the item with your rubric and note; in a wired deployment they feed the eval set and the agent owner."
      />
      <ReviewStats />
      <Suspense fallback={<TableSkeleton toolbar={false} />}>
        <ReviewQueueView />
      </Suspense>
    </>
  )
}
