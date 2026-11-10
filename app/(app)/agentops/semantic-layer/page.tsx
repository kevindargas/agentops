import { Suspense } from "react"
import type { Metadata } from "next"
import { BookMarkedIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { SemanticLayer } from "@/features/agentops/semantic-layer"
import { semanticEntities } from "@/lib/data"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Semantic Layer" }

export default function SemanticLayerPage() {
  const verified = semanticEntities.filter(
    (s) => s.status === "Verified"
  ).length
  const issues = semanticEntities.reduce((n, s) => n + s.issues.length, 0)
  const draftInUse = semanticEntities.filter(
    (s) => s.status !== "Verified" && s.usedByAgentIds.length > 0
  ).length
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<BookMarkedIcon />}
        title="Semantic Layer"
        description="The governed vocabulary agents are allowed to reason with: metrics, dimensions, entities and glossary terms with one definition, one formula and known synonyms. Unverified definitions in use are the most common cause of confident wrong answers."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Definitions"
          value={semanticEntities.length}
          hint={`${verified} verified`}
        />
        <StatCard
          size="sm"
          label="Lint issues"
          value={issues}
          upIsGood={false}
          hint="Stale, ambiguous or unowned"
        />
        <StatCard
          size="sm"
          label="Unverified in use"
          value={draftInUse}
          upIsGood={false}
          hint="Referenced by agents"
        />
        <StatCard
          size="sm"
          label="Queries · 30d"
          value={formatNumber(
            semanticEntities.reduce((n, s) => n + s.queries30d, 0),
            true
          )}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SemanticLayer />
      </Suspense>
    </>
  )
}
