import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import {
  KnowledgeStats,
  KnowledgeTabs,
} from "@/features/agentops/knowledge/knowledge-tabs"

export const metadata: Metadata = { title: "Knowledge & Memory" }

export default function KnowledgePage() {
  return (
    <>
      <PageHeader
        nav="/agentops/knowledge"
        description="What agents can retrieve and remember: the vector indexes they query, the sources feeding them, the memory each agent keeps between turns, and how often retrieval actually finds something worth citing. Stale sources and low-recall queries are where grounded answers quietly turn into guesses."
      />
      <KnowledgeStats />
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <KnowledgeTabs />
      </Suspense>
    </>
  )
}
