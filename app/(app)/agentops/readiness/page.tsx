import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { ReadinessRoute } from "@/features/agentops/readiness/readiness-route"
import { defaultControlSet } from "@/lib/readiness/controls"

export const metadata: Metadata = { title: "Readiness Assessment" }

/**
 * Static shell. `?tab=` and `?control=` are read on the client by
 * `ReadinessRoute` inside the Suspense boundary, so this page never touches
 * `searchParams` and can be exported statically.
 */
export default function ReadinessPage() {
  const set = defaultControlSet
  const domainList = set.domains.map((d) => d.title.toLowerCase()).join(", ")
  return (
    <>
      <PageHeader
        nav="/agentops/readiness"
        description={`Self-assess an AI system against ${set.controls.length} controls across ${set.domains.length} domains (${domainList}), mapped to OWASP LLM Top 10, NIST AI RMF, the EU AI Act, OTel GenAI conventions and ISO/IEC 42001. Runs entirely in your browser.`}
      />
      <Suspense fallback={<TableSkeleton />}>
        <ReadinessRoute />
      </Suspense>
    </>
  )
}
