import { Suspense } from "react"
import type { Metadata } from "next"

import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { KnowledgeTable } from "@/features/knowledge/knowledge-table"
import { NewArticleSheet } from "@/features/knowledge/new-article-sheet"
import { knowledgeArticles } from "@/lib/data/catalog"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Knowledge" }

export default function KnowledgePage() {
  const published = knowledgeArticles.filter((k) => k.state === "Published")
  const review = knowledgeArticles.filter((k) => k.state === "Review").length
  const drafts = knowledgeArticles.filter((k) => k.state === "Draft").length
  const views = knowledgeArticles.reduce((a, k) => a + k.views, 0)
  const helpful = knowledgeArticles.reduce((a, k) => a + k.helpful, 0)
  const total = knowledgeArticles.reduce(
    (a, k) => a + k.helpful + k.notHelpful,
    0
  )
  const bases = new Set(knowledgeArticles.map((k) => k.knowledgeBase)).size
  return (
    <>
      <PageHeader
        nav="/itsm/knowledge"
        description="Capture, review and publish articles so employees can self-serve and agents resolve faster. Known errors are linked from problems."
        actions={
          <Suspense fallback={<Skeleton className="h-8 w-32" />}>
            <NewArticleSheet />
          </Suspense>
        }
      />
      <StatGrid columns={4}>
        <StatCard
          label="Published articles"
          value={published.length}
          hint={`Across ${bases} knowledge bases`}
        />
        <StatCard
          label="Awaiting review"
          value={review}
          hint={`${drafts} draft${drafts === 1 ? "" : "s"} in progress`}
        />
        <StatCard
          label="Total views"
          value={formatNumber(views, true)}
          hint="All articles, lifetime"
        />
        <StatCard
          label="Helpful rating"
          value={`${Math.round((helpful / Math.max(1, total)) * 100)}%`}
          hint={`${formatNumber(total, true)} votes`}
        />
      </StatGrid>
      <Suspense fallback={<TableSkeleton columns={7} />}>
        <KnowledgeTable />
      </Suspense>
    </>
  )
}
