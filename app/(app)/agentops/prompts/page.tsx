import type { Metadata } from "next"
import { Suspense } from "react"

import { TableSkeleton } from "@/components/shared/skeletons"
import { PageHeader } from "@/components/shared/page-header"
import { NewPromptButton } from "@/features/agentops/prompts/new-prompt-sheet"
import { PromptsStats } from "@/features/agentops/prompts/prompts-table"
import { PromptsView } from "@/features/agentops/prompts/prompts-view"

export const metadata: Metadata = { title: "Prompts" }

export default function PromptsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/prompts"
        description="Prompt Registry: the system of record for every prompt the fleet runs. Each version is immutable, evaluated against the agent's golden set and promoted explicitly, so a regression can always be traced to a diff."
        actions={<NewPromptButton />}
      />
      <PromptsStats />
      <Suspense fallback={<TableSkeleton columns={7} />}>
        <PromptsView />
      </Suspense>
    </>
  )
}
