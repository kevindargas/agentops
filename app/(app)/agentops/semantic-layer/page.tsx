import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import {
  SemanticLayer,
  SemanticStats,
} from "@/features/agentops/semantic-layer"

export const metadata: Metadata = { title: "Semantic Layer" }

export default function SemanticLayerPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/semantic-layer"
        description="The governed vocabulary agents are allowed to reason with: metrics, dimensions, entities and glossary terms with one definition, one formula and known synonyms. Unverified definitions in use are the most common cause of confident wrong answers."
      />
      <SemanticStats />
      <Suspense fallback={<TableSkeleton columns={6} />}>
        <SemanticLayer />
      </Suspense>
    </>
  )
}
