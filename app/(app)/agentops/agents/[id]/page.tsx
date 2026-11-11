import type { Metadata } from "next"
import Link from "next/link"
import {
  BotIcon,
  ClockIcon,
  GitForkIcon,
  LightbulbIcon,
  RocketIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { RecordTabs } from "@/components/record/record-tabs"
import { DetailList } from "@/components/shared/detail-list"
import { MetricTile } from "@/components/shared/metric-tile"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AgentActions,
  AgentHealthBadges,
} from "@/features/agentops/agent-config/agent-actions"
import { AgentConfigPanel } from "@/features/agentops/agent-config/agent-config-panel"
import { AgentQualityCharts } from "@/features/agentops/agent-config/agent-quality-charts"
import { AgentSloCard } from "@/features/agentops/agent-config/agent-slo-card"
import { AgentGraph } from "@/features/agentops/agent-graph"
import { ExperimentsTable } from "@/features/agentops/experiments"
import { RecommendationsList } from "@/features/agentops/recommendations-list"
import { FrameworkBadge, ModelChip, ScoreBar } from "@/features/agentops/shared"
import { TracesTable } from "@/features/agentops/traces-table"
import {
  agentTraces,
  deployedAgents,
  driftSignals,
  experiments,
  getDeployedAgent,
  modelRecommendations,
  openDriftSeverity,
  reviewItems,
} from "@/lib/data/agentops"
import { getPromptForAgent } from "@/lib/data/prompts"
import { daysAgo } from "@/lib/data/seed"
import {
  formatCost,
  formatDate,
  formatMs,
  formatNumber,
  formatTokens,
  timeAgo,
} from "@/lib/format"

/**
 * Every sample record is prerendered at build time so the static export has a
 * page per id; anything else is a 404. The server build gets the same list.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return deployedAgents.map((agent) => ({ id: agent.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: getDeployedAgent(id)?.name ?? id }
}

/** Axis label for the i-th of 14 trailing days, anchored to the demo clock. */
const day = (i: number) => formatDate(daysAgo(13 - i), { year: undefined })

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const agent = getDeployedAgent(id)
  if (!agent)
    return (
      <RecordNotFound
        number={id}
        backHref="/agentops/agents"
        backLabel="agents"
      />
    )

  const traces = agentTraces.filter((t) => t.agentId === agent.id)
  const drift = driftSignals.filter(
    (d) => d.agentId === agent.id && d.state !== "Resolved"
  )
  const openSeverity = openDriftSeverity(agent.id)
  const exps = experiments.filter((e) => e.agentId === agent.id)
  const recs = modelRecommendations.filter(
    (r) =>
      r.agentId === agent.id && (r.status === "New" || r.status === "Testing")
  )
  const pending = reviewItems.filter(
    (r) => r.agentId === agent.id && r.status === "Pending"
  ).length
  const m = agent.metrics
  const prompt = getPromptForAgent(agent.id)
  const bounded = traces.filter((t) => t.boundHit).length
  const promptHref = prompt
    ? `/agentops/prompts/${prompt.id}`
    : "/agentops/prompts"
  const goldenSetHref = `/agentops/evals?tab=datasets&dataset=${agent.evalDataset}`
  const series = agent.qualityTrend.map((q, i) => ({
    name: day(i),
    quality: q,
    requests: agent.trafficTrend[i],
  }))

  return (
    <>
      <RecordHeader
        number={agent.id}
        title={agent.name}
        backHref="/agentops/agents"
        backLabel="agents"
        description={agent.description}
        badges={
          <>
            <AgentHealthBadges agent={agent} />
            <FrameworkBadge framework={agent.framework} />
            <StateBadge state={agent.environment} size="sm" />
            <Badge
              variant="outline"
              className="font-mono text-2xs text-muted-foreground"
            >
              {agent.version}
            </Badge>
          </>
        }
        meta={
          <>
            <MetaItem label="Owner" icon={<UserIcon />}>
              <UserChip userId={agent.ownerId} size="xs" />
            </MetaItem>
            <MetaItem label="Team" icon={<UsersIcon />}>
              {agent.team}
            </MetaItem>
            <MetaItem label="Model" icon={<BotIcon />}>
              <ModelChip modelId={agent.modelId} className="text-xs" />
            </MetaItem>
            <MetaItem label="Deployed" icon={<ClockIcon />}>
              {timeAgo(agent.lastDeployed)}
            </MetaItem>
            <MetaItem
              label="Drift"
              icon={<RocketIcon />}
              href={`/agentops/drift?agent=${agent.id}`}
              tone={
                openSeverity === "Critical" || agent.driftScore >= 0.25
                  ? "danger"
                  : openSeverity === "Warning" || agent.driftScore >= 0.1
                    ? "warning"
                    : "default"
              }
            >
              PSI {agent.driftScore.toFixed(2)}
              {drift.length > 0 &&
                ` · ${drift.length} open signal${drift.length === 1 ? "" : "s"}`}
            </MetaItem>
          </>
        }
        actions={<AgentActions agent={agent} promptHref={promptHref} />}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection title="Evals" size="sm">
              <div className="grid grid-cols-2 gap-3">
                <MetricTile
                  label="Quality"
                  value={<ScoreBar value={m.quality} />}
                />
                <MetricTile
                  label="Thumbs-down"
                  value={`${m.thumbsDownRate.toFixed(1)}%`}
                  tone={m.thumbsDownRate > 5 ? "danger" : undefined}
                />
                <MetricTile label="Review rate" value={`${m.reviewRate}%`} />
                <MetricTile
                  label="Pending reviews"
                  value={pending}
                  hint={
                    <Link href={`/agentops/reviews?agent=${agent.id}`}>
                      Open queue
                    </Link>
                  }
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Golden set{" "}
                <Link
                  href={goldenSetHref}
                  className="rounded-sm bg-muted px-1 font-mono text-2xs hover:underline"
                >
                  {agent.evalDataset}
                </Link>{" "}
                · prompt{" "}
                <Link
                  href={promptHref}
                  className="rounded-sm bg-muted px-1 font-mono text-2xs hover:underline"
                >
                  {agent.promptVersion}
                </Link>
              </p>
            </RecordSection>
            <AgentSloCard agent={agent} />
            <RecordSection title="Configuration" size="sm">
              <DetailList
                variant="rows"
                dense
                items={[
                  {
                    label: "Model",
                    value: (
                      <ModelChip modelId={agent.modelId} className="text-xs" />
                    ),
                  },
                  {
                    label: "Fallback",
                    value: agent.fallbackModelId ? (
                      <ModelChip
                        modelId={agent.fallbackModelId}
                        className="text-xs"
                      />
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    ),
                  },
                  {
                    label: "Releases",
                    value: (
                      <Link
                        href={`/agentops/deployments?agent=${agent.id}`}
                        className="hover:underline"
                      >
                        Deployments for {agent.name}
                      </Link>
                    ),
                  },
                  {
                    label: "Tools",
                    value: (
                      <span className="flex flex-wrap gap-1">
                        {agent.tools.map((t) => (
                          <Link
                            key={t}
                            href={`/agentops/tools?tool=${t}`}
                            className="rounded-sm bg-muted px-1 py-0.5 font-mono text-2xs hover:underline"
                          >
                            {t}
                          </Link>
                        ))}
                        {agent.tools.length === 0 && (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </span>
                    ),
                    wide: true,
                  },
                ]}
              />
            </RecordSection>
            {drift.length > 0 && (
              <RecordSection
                title="Open drift signals"
                count={drift.length}
                size="sm"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/agentops/drift?agent=${agent.id}`} />}
                  >
                    Board
                  </Button>
                }
              >
                <ul className="flex flex-col gap-2">
                  {drift.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{d.metric}</span>
                      <StateBadge state={d.severity} size="sm" />
                    </li>
                  ))}
                </ul>
              </RecordSection>
            )}
            {recs.length > 0 && (
              <RecordSection
                title="Recommendations"
                count={recs.length}
                size="sm"
                icon={<LightbulbIcon />}
              >
                <ul className="flex flex-col gap-2">
                  {recs.map((r) => (
                    <li key={r.id} className="text-sm leading-snug">
                      <Link
                        href={`/agentops/recommendations?open=${r.id}`}
                        className="hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className="block text-2xs text-muted-foreground">
                        {Math.round(r.confidence * 100)}% confidence
                      </span>
                    </li>
                  ))}
                </ul>
              </RecordSection>
            )}
          </>
        }
      >
        <StatGrid columns={4}>
          <StatCard
            label="Requests · 24h"
            value={formatNumber(m.requests24h)}
            hint={`${formatTokens(m.tokens24h)} tokens`}
          />
          <StatCard
            label="Latency p95"
            value={formatMs(m.p95Ms)}
            hint={`p50 ${formatMs(m.p50Ms)}`}
          />
          <StatCard
            label="Error rate"
            value={`${m.errorRate.toFixed(1)}%`}
            upIsGood={false}
            hint={
              bounded
                ? `${bounded} run${bounded === 1 ? "" : "s"} hit a run limit`
                : m.errorRate > 3
                  ? "Above 3% threshold"
                  : "Within threshold"
            }
          />
          <StatCard
            label="Cost · day"
            value={formatCost(m.costPerDay, 0)}
            hint={`${formatCost(m.requests24h ? m.costPerDay / m.requests24h : 0, 3)} per request`}
          />
        </StatGrid>

        <RecordSection
          title="Graph"
          description={`${agent.framework} state graph · ${agent.graph.length} nodes`}
          icon={<GitForkIcon />}
        >
          <AgentGraph nodes={agent.graph} />
        </RecordSection>

        <RecordTabs
          defaultValue="traces"
          tabs={[
            {
              value: "traces",
              label: "Traces",
              count: traces.length,
              content: <TracesTable agentId={agent.id} compact />,
            },
            {
              value: "quality",
              label: "Quality",
              content: <AgentQualityCharts series={series} />,
            },
            {
              value: "experiments",
              label: "Experiments",
              count: exps.length,
              content: <ExperimentsTable agentId={agent.id} />,
            },
            {
              value: "recommendations",
              label: "Recommendations",
              count: recs.length,
              content: <RecommendationsList agentId={agent.id} />,
            },
            {
              value: "configuration",
              label: "Configuration",
              icon: <SlidersHorizontalIcon />,
              content: (
                <AgentConfigPanel agent={agent} promptHref={promptHref} />
              ),
            },
          ]}
        />
      </RecordLayout>
    </>
  )
}
