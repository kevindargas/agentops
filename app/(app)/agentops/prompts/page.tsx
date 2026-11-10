import type { Metadata } from "next"
import { ScrollTextIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { NewPromptButton } from "@/features/agentops/prompts/new-prompt-sheet"
import { PromptsTable } from "@/features/agentops/prompts/prompts-table"
import { productionVersion, prompts, promptVersions } from "@/lib/data/prompts"

export const metadata: Metadata = { title: "Prompts" }

export default function PromptsPage() {
  const production = promptVersions.filter((v) => v.label === "production")
  const awaiting = promptVersions.filter((v) => v.review === "Pending Approval")
  const scored = prompts
    .map((p) => productionVersion(p)?.evalScore ?? null)
    .filter((s): s is number => s !== null)
  const avg = scored.length
    ? scored.reduce((a, b) => a + b, 0) / scored.length
    : 0
  const agents = new Set(prompts.map((p) => p.agentId)).size

  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<ScrollTextIcon />}
        title="Prompt Registry"
        description="System of record for every prompt the fleet runs. Each version is immutable, evaluated against the agent's golden set and promoted explicitly, so a regression can always be traced to a diff."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Prompts"
          value={prompts.length}
          hint={`across ${agents} agents`}
        />
        <StatCard
          size="sm"
          label="Versions"
          value={promptVersions.length}
          hint={`${production.length} in production`}
        />
        <StatCard
          size="sm"
          label="Awaiting review"
          value={awaiting.length}
          hint="staging and drafts pending approval"
        />
        <StatCard
          size="sm"
          label="Avg eval score"
          value={avg.toFixed(1)}
          hint="production versions, golden sets"
        />
      </div>
      <PromptsTable toolbar={<NewPromptButton />} />
    </>
  )
}
