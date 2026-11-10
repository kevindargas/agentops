import type { Metadata } from "next"
import { WavesIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DriftBoard } from "@/features/agentops/drift-board"

export const metadata: Metadata = { title: "Drift & Quality" }

export default function DriftPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<WavesIcon />}
        title="Drift & Quality"
        description="Input distribution, output behaviour, evaluator quality, tool reliability and cost, each compared with the agent's trailing baseline. Signals explain what moved and link straight to traces and experiments."
      />
      <DriftBoard />
    </>
  )
}
