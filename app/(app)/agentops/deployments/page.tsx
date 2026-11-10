import type { Metadata } from "next"
import { RocketIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnvironmentsMatrix } from "@/features/agentops/deployments/environments-matrix"
import { ReleaseApprovals } from "@/features/agentops/deployments/release-approvals"
import { ReleasesTable } from "@/features/agentops/deployments/releases-table"
import { NOW } from "@/lib/data"
import {
  releaseApprovals,
  releases,
  timeToPromoteHours,
} from "@/lib/data/deployments"
import { formatDuration } from "@/lib/format"

export const metadata: Metadata = { title: "Deployments & releases" }

const DAY = 86_400_000

export default async function DeploymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; agent?: string }>
}) {
  const { tab, agent } = await searchParams
  const since7 = new Date(NOW.getTime() - 7 * DAY).toISOString()
  const since30 = new Date(NOW.getTime() - 30 * DAY).toISOString()

  const deploys7d = releases.filter(
    (r) => r.deployedAt && r.deployedAt >= since7
  )
  const finished30d = releases.filter(
    (r) =>
      r.completedAt &&
      r.completedAt >= since30 &&
      (r.stage === "Promoted" ||
        r.stage === "Rolled back" ||
        r.stage === "Failed")
  )
  const promoted30d = finished30d.filter((r) => r.stage === "Promoted")
  const rollbacks30d = finished30d.filter((r) => r.stage === "Rolled back")
  const successRate = finished30d.length
    ? Math.round((promoted30d.length / finished30d.length) * 100)
    : 100
  const canaries = releases.filter(
    (r) => r.stage === "Canary" || r.stage === "Progressing"
  )
  const promoteHours = releases
    .map(timeToPromoteHours)
    .filter((h): h is number => h !== null)
  const meanPromote =
    promoteHours.reduce((a, b) => a + b, 0) / Math.max(1, promoteHours.length)

  const defaultTab =
    tab === "environments" || tab === "approvals" ? tab : "releases"

  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<RocketIcon />}
        title="Deployments & releases"
        description="Every prompt, model, tool or parameter change ships as a release with an eval gate, approvals and a staged rollout. Promote when the canary holds, roll back in one click when it does not."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          size="sm"
          label="Deploys · 7d"
          value={deploys7d.length}
          hint={`${releases.filter((r) => r.createdAt >= since7).length} drafted`}
        />
        <StatCard
          size="sm"
          label="Success rate · 30d"
          value={`${successRate}%`}
          hint={`${promoted30d.length} promoted of ${finished30d.length}`}
        />
        <StatCard
          size="sm"
          label="Active canaries"
          value={canaries.length}
          hint={
            canaries.length
              ? canaries.map((c) => `${c.traffic}%`).join(" · ") + " traffic"
              : "None in flight"
          }
        />
        <StatCard
          size="sm"
          label="Rollbacks · 30d"
          value={rollbacks30d.length}
          upIsGood={false}
          hint={
            rollbacks30d.length
              ? `${finished30d.filter((r) => r.stage === "Failed").length} failed health checks`
              : "Clean month"
          }
        />
        <StatCard
          size="sm"
          label="Awaiting approval"
          value={releaseApprovals.length}
          hint={`${releaseApprovals.filter((a) => a.risk === "High").length} high risk`}
        />
        <StatCard
          size="sm"
          label="Mean time to promote"
          value={formatDuration(meanPromote)}
          hint="Draft → 100% traffic"
        />
      </div>

      <Tabs defaultValue={defaultTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="releases">
            Releases
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {releases.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {releaseApprovals.length > 0 && (
              <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-warning/20 text-[10px] font-medium text-warning-text tabular-nums">
                {releaseApprovals.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="releases">
          <ReleasesTable
            initialFacets={agent ? { agent: [agent] } : undefined}
          />
        </TabsContent>
        <TabsContent value="environments">
          <EnvironmentsMatrix />
        </TabsContent>
        <TabsContent value="approvals">
          <ReleaseApprovals />
        </TabsContent>
      </Tabs>
    </>
  )
}
