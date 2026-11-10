import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  BookOpenIcon,
  EyeIcon,
  FileClockIcon,
  PlusIcon,
  ThumbsUpIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { KnowledgeTable } from "@/features/knowledge/knowledge-table"
import { knowledgeArticles } from "@/lib/data"
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
        title="Knowledge"
        description="Capture, review and publish articles so employees can self-serve and agents resolve faster. Known errors are linked from problems."
        actions={
          <>
            <Button render={<Link href="/itsm/knowledge?new=1" />}>
              <PlusIcon /> New article
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Published articles"
          value={published.length}
          icon={<BookOpenIcon />}
          hint={`Across ${bases} knowledge bases`}
        />
        <StatCard
          label="Awaiting review"
          value={review}
          icon={<FileClockIcon />}
          hint={`${drafts} draft${drafts === 1 ? "" : "s"} in progress`}
        />
        <StatCard
          label="Total views"
          value={formatNumber(views, true)}
          delta={9}
          icon={<EyeIcon />}
        />
        <StatCard
          label="Helpful rating"
          value={`${Math.round((helpful / Math.max(1, total)) * 100)}%`}
          delta={1.4}
          icon={<ThumbsUpIcon />}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <KnowledgeTable />
      </Suspense>
    </>
  )
}
