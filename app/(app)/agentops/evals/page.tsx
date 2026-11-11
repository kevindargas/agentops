import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { EvalsRoute } from "@/features/agentops/evals/evals-route"
import { EvalsStats } from "@/features/agentops/evals/evals-stats"

export const metadata: Metadata = { title: "Evals & Datasets" }

/**
 * Static shell. `?tab=`, `?dataset=`, `?run=` and `?agent=` are read on the
 * client by `EvalsRoute` inside the Suspense boundary, so this page never
 * touches `searchParams` and can be exported statically.
 */
export default function EvalsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/evals"
        description="Regression tests for prompts, models and agents. Every candidate runs against a golden set, each case is scored by LLM judges and code evaluators, and release gates, when defined, decide whether it can be promoted."
      />
      <EvalsStats />
      <Suspense fallback={<TableSkeleton />}>
        <EvalsRoute />
      </Suspense>
    </>
  )
}
