import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { ReadinessView } from "@/features/agentops/readiness/readiness-view"
import { defaultControlSet } from "@/lib/readiness/controls"

export const metadata: Metadata = { title: "Readiness Assessment" }

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; control?: string }>
}) {
  const { tab, control } = await searchParams
  const set = defaultControlSet
  const domainList = set.domains.map((d) => d.title.toLowerCase()).join(", ")
  return (
    <>
      <PageHeader
        nav="/agentops/readiness"
        description={`Self-assess an AI system against ${set.controls.length} controls across ${set.domains.length} domains (${domainList}), mapped to OWASP LLM Top 10, NIST AI RMF, the EU AI Act, OTel GenAI conventions and ISO/IEC 42001. Runs entirely in your browser.`}
      />
      <ReadinessView initialTab={tab} initialControlId={control} />
    </>
  )
}
