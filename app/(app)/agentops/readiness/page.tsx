import type { Metadata } from "next"
import { ClipboardListIcon } from "lucide-react"

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
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<ClipboardListIcon />}
        title="Readiness Assessment"
        description={`Self-assess an AI system against ${set.controls.length} controls across ${set.domains.length} domains — visibility, quality, drift, safety, cost & performance, governance — mapped to OWASP LLM Top 10, NIST AI RMF, the EU AI Act and OTel GenAI conventions. Runs entirely in your browser.`}
      />
      <ReadinessView initialTab={tab} initialControlId={control} />
    </>
  )
}
