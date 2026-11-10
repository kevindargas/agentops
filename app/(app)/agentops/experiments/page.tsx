import type { Metadata } from "next"
import { FlaskConicalIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ExperimentsTable } from "@/features/agentops/experiments"
import { experiments } from "@/lib/data"

export const metadata: Metadata = { title: "Experiments" }

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>
}) {
  const { open } = await searchParams
  const running = experiments.filter((e) => e.status === "Running")
  const decided = experiments.filter(
    (e) =>
      e.status === "Completed" ||
      e.status === "Promoted" ||
      e.status === "Stopped"
  )
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<FlaskConicalIcon />}
        title="Experiments"
        description="A/B tests on models, prompts, retrieval and tooling. Traffic is split per session, the primary metric is tracked daily, and a variant can be promoted once it clears 95% confidence."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          size="sm"
          label="Running"
          value={running.length}
          hint={`${running.filter((e) => e.significance >= 0.95).length} ready to decide`}
        />
        <StatCard
          size="sm"
          label="Decided"
          value={decided.length}
          hint={`${experiments.filter((e) => e.winner === "B").length} variants won`}
        />
        <StatCard
          size="sm"
          label="Drafts"
          value={experiments.filter((e) => e.status === "Draft").length}
        />
      </div>
      <ExperimentsTable key={open ?? "none"} initialOpenId={open} />
    </>
  )
}
