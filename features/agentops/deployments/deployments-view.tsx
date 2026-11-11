"use client"

import { setQueryParams } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDuration } from "@/lib/format"
import { EnvironmentsMatrix } from "./environments-matrix"
import { ReleaseApprovals } from "./release-approvals"
import { ReleasesTable } from "./releases-table"
import {
  approvalsFrom,
  decisionStore,
  deploymentStats,
  releaseStore,
} from "./store"

import { isDeploymentsTab, type DeploymentsTab } from "./tabs"

export { isDeploymentsTab, type DeploymentsTab }

/**
 * Stat row and tab shell for /agentops/deployments. Everything reads the
 * release store, so approving, rolling back or drafting a release updates the
 * cards and the tab counts in place. `?tab=` and `?agent=` are read by
 * `DeploymentsRoute` and passed in; tab changes are written back with
 * `setQueryParams` (no navigation), so the URL stays the source of truth.
 */
export function DeploymentsView({
  tab = "releases",
  agentId,
}: {
  /** `?tab=`, already validated with `isDeploymentsTab`. */
  tab?: DeploymentsTab
  /** `?agent=`: preselects the Agent facet and tints the environments row. */
  agentId?: string
}) {
  const releases = releaseStore.use()
  const { decisions } = decisionStore.use()
  const approvals = approvalsFrom(releases)
  const open = approvals.filter((a) => !decisions[a.id])
  const stats = deploymentStats(releases)

  const changeTab = (next: DeploymentsTab) =>
    setQueryParams({ tab: next === "releases" ? null : next, agent: agentId })

  return (
    <>
      <StatGrid columns={6}>
        <StatCard
          label="Deploys · 7d"
          value={stats.deploys7d}
          hint={`${stats.drafted7d} drafted`}
        />
        <StatCard
          label="Success rate · 30d"
          value={`${stats.successRate}%`}
          hint={`${stats.promoted30d} promoted of ${stats.finished30d}`}
        />
        <StatCard
          label="Active canaries"
          value={stats.canaries.length}
          hint={
            stats.canaries.length
              ? stats.canaries.map((c) => `${c.traffic}%`).join(" · ") +
                " traffic"
              : "None in flight"
          }
        />
        <StatCard
          label="Rollbacks · 30d"
          value={stats.rollbacks30d}
          upIsGood={false}
          hint={
            stats.rollbacks30d
              ? `${stats.failed30d} failed health checks`
              : "Clean month"
          }
        />
        <StatCard
          label="Awaiting approval"
          value={open.length}
          hint={`${open.filter((a) => a.risk === "High").length} high risk`}
          href="/agentops/deployments?tab=approvals"
        />
        <StatCard
          label="Mean time to promote"
          value={formatDuration(stats.meanPromoteHours)}
          hint="Draft to 100% traffic"
        />
      </StatGrid>

      <Tabs
        value={tab}
        onValueChange={(v) => changeTab(v as DeploymentsTab)}
        className="gap-4"
      >
        <TabsList aria-label="Deployments sections">
          <TabsTrigger value="releases">
            Releases
            <CountPill count={releases.length} />
          </TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {open.length > 0 && (
              <CountPill count={open.length} tone="warning" label="pending" />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="releases">
          <ReleasesTable
            // Seeded once per `?agent=`; the table never writes that param.
            key={agentId ?? ""}
            initialFacets={agentId ? { agent: [agentId] } : undefined}
          />
        </TabsContent>
        <TabsContent value="environments">
          <EnvironmentsMatrix highlightAgentId={agentId} />
        </TabsContent>
        <TabsContent value="approvals">
          <ReleaseApprovals />
        </TabsContent>
      </Tabs>
    </>
  )
}
