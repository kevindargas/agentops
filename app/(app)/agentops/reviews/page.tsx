import type { Metadata } from "next"
import { ClipboardCheckIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ReviewQueue } from "@/features/agentops/review-queue"
import { reviewItems } from "@/lib/data"

export const metadata: Metadata = { title: "Review Queue" }

export default function ReviewsPage() {
  const pending = reviewItems.filter((r) => r.status === "Pending")
  const done = reviewItems.filter((r) => r.status !== "Pending")
  const approved = done.filter((r) => r.status === "Approved").length
  const rubric = done.filter((r) => r.rubric)
  const avg = rubric.length
    ? rubric.reduce(
        (s, r) =>
          s +
          (r.rubric!.accuracy +
            r.rubric!.grounding +
            r.rubric!.tone +
            r.rubric!.safety) /
            4,
        0
      ) / rubric.length
    : 0
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<ClipboardCheckIcon />}
        title="Review Queue"
        description="Humans in the loop. Answers sampled by evaluator flags, negative feedback, policy matches or random draw wait here for a verdict. Approvals become positive examples; corrections update the eval set; flags go to the agent owner."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Pending"
          value={pending.length}
          hint={`${pending.filter((r) => r.priority <= 2).length} high priority`}
        />
        <StatCard
          size="sm"
          label="Reviewed · 48h"
          value={done.length}
          hint={`${approved} approved · ${done.filter((r) => r.status === "Corrected").length} corrected · ${done.filter((r) => r.status === "Flagged").length} flagged`}
        />
        <StatCard
          size="sm"
          label="Approval rate"
          value={`${Math.round((approved / Math.max(1, done.length)) * 100)}%`}
        />
        <StatCard
          size="sm"
          label="Avg rubric score"
          value={avg.toFixed(1)}
          unit="/5"
        />
      </div>
      <ReviewQueue />
    </>
  )
}
