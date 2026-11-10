import type { Metadata } from "next"
import { ShieldCheckIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { GuardrailsView } from "@/features/agentops/guardrails/guardrails-view"
import { guardrailStats } from "@/lib/data/guardrails"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Guardrails & Policies" }

export default async function GuardrailsPage({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string; tab?: string }>
}) {
  const { policy, tab } = await searchParams
  const s = guardrailStats()
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<ShieldCheckIcon />}
        title="Guardrails & Policies"
        description="The rules that bound what agents may read, say and do. Policies are versioned as code, scoped per agent, and every trigger links back to the trace it fired on."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          size="sm"
          label="Active policies"
          value={s.active}
          hint={`${s.total - s.active} disabled or draft`}
        />
        <StatCard
          size="sm"
          label="Blocked · 24h"
          value={formatNumber(s.blocked24h)}
          hint="Across Block-mode policies"
        />
        <StatCard
          size="sm"
          label="Flagged · 24h"
          value={formatNumber(s.flagged24h)}
          hint="Routed to review, not stopped"
        />
        <StatCard
          size="sm"
          label="False-positive rate"
          value={`${(s.fpRate * 100).toFixed(0)}%`}
          hint={`From ${s.decided} reviewer verdicts`}
        />
        <StatCard
          size="sm"
          label="Agents without output guardrails"
          value={s.withoutOutput.length}
          className={
            s.withoutOutput.length > 0
              ? "border-warning/40 bg-warning/5 [&_[data-slot=card-title]]:text-warning-text"
              : undefined
          }
          hint={
            s.withoutOutput.length > 0
              ? s.withoutOutput.map((a) => a.name).join(", ")
              : "Every agent has at least one"
          }
          href="/agentops/guardrails?tab=coverage"
        />
      </div>
      <GuardrailsView
        key={`${policy ?? ""}:${tab ?? ""}`}
        initialPolicyId={policy}
        initialTab={tab}
      />
    </>
  )
}
