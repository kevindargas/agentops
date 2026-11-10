import type { Metadata } from "next"
import { LightbulbIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { RecommendationsList } from "@/features/agentops/recommendations-list"

export const metadata: Metadata = { title: "Recommendations" }

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<LightbulbIcon />}
        title="Model change recommendations"
        description="Generated from shadow evaluations, running experiments, cost telemetry and provider deprecation notices. Each one shows the evidence, so a human decides what ships."
      />
      <RecommendationsList />
    </>
  )
}
