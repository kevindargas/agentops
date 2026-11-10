import { Suspense } from "react"
import type { Metadata } from "next"
import { LibraryIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { KnowledgeTabs } from "@/features/agentops/knowledge/knowledge-tabs"
import {
  kbTotals,
  knowledgeBases,
  kbSources,
  memoryStores,
  retrievalDaily,
} from "@/lib/data/knowledge"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Knowledge & Memory" }

export default function KnowledgePage() {
  const healthy = knowledgeBases.filter((k) => k.status === "Healthy").length
  const failing = kbSources.filter((s) => s.status === "Failed").length
  const today = retrievalDaily[retrievalDaily.length - 1]
  const yesterday = retrievalDaily[retrievalDaily.length - 2]
  const longTerm = memoryStores.filter((m) => m.type !== "session").length

  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<LibraryIcon />}
        title="Knowledge & Memory"
        description="What agents can retrieve and remember: the vector indexes they query, the sources feeding them, the memory each agent keeps between turns, and how often retrieval actually finds something worth citing. Stale sources and low-recall queries are where grounded answers quietly turn into guesses."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          size="sm"
          label="Knowledge bases"
          value={kbTotals.knowledgeBases}
          hint={`${healthy} healthy`}
        />
        <StatCard
          size="sm"
          label="Documents indexed"
          value={formatNumber(kbTotals.documents, true)}
          hint={`${kbSources.length} sources`}
        />
        <StatCard
          size="sm"
          label="Chunks"
          value={formatNumber(kbTotals.chunks, true)}
          hint="Across all stores"
        />
        <StatCard
          size="sm"
          label="Stale sources"
          value={kbTotals.staleSources}
          upIsGood={false}
          hint={`${failing} failed · >7d or paused`}
        />
        <StatCard
          size="sm"
          label="Retrieval hit rate · 24h"
          value={today.hitRate.toFixed(1)}
          unit="%"
          delta={Math.round((today.hitRate - yesterday.hitRate) * 10) / 10}
          deltaUnit="pt"
          deltaLabel="vs yesterday"
        />
        <StatCard
          size="sm"
          label="Memory records"
          value={formatNumber(kbTotals.memoryRecords, true)}
          hint={`${longTerm} long-term stores`}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <KnowledgeTabs />
      </Suspense>
    </>
  )
}
