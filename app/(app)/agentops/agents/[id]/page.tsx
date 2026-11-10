import type { Metadata } from "next"
import Link from "next/link"
import {
  BotIcon,
  ClockIcon,
  FlaskConicalIcon,
  GitForkIcon,
  LightbulbIcon,
  PauseIcon,
  RocketIcon,
  RouteIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"

import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { RecordTabs } from "@/components/record/record-tabs"
import { DetailList } from "@/components/shared/detail-list"
import { StatCard } from "@/components/shared/stat-card"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentConfigPanel } from "@/features/agentops/agent-config/agent-config-panel"
import { AgentQualityCharts } from "@/features/agentops/agent-config/agent-quality-charts"
import { AgentGraph } from "@/features/agentops/agent-graph"
import { ExperimentsTable } from "@/features/agentops/experiments"
import { RecommendationsList } from "@/features/agentops/recommendations-list"
import { fmtCost, fmtMs, fmtTokens } from "@/features/agentops/format"
import { FrameworkBadge, ModelChip, ScoreBar } from "@/features/agentops/shared"
import { TracesTable } from "@/features/agentops/traces-table"
import {
  agentTraces,
  driftSignals,
  experiments,
  getDeployedAgent,
  modelRecommendations,
  reviewItems,
} from "@/lib/data"
import { getPromptForAgent } from "@/lib/data/prompts"
import { formatNumber, timeAgo } from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: getDeployedAgent(id)?.name ?? id }
}

const day = (i: number) =>
  new Date(Date.UTC(2026, 10, 5 - (13 - i))).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

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
  const promptHref = prompt
    ? `/agentops/prompts/${prompt.id}`
    : `/agentops/prompts?agent=${agent.id}`
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
            <StateBadge state={agent.health} />
            <FrameworkBadge framework={agent.framework} />
            <StateBadge state={agent.environment} size="sm" />
            <Badge
              variant="outline"
              className="font-mono text-[11px] text-muted-foreground"
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
              tone={
                agent.driftScore >= 0.25
                  ? "danger"
                  : agent.driftScore >= 0.1
                    ? "warning"
                    : "default"
              }
            >
              PSI {agent.driftScore.toFixed(2)}
            </MetaItem>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href={`/agentops/traces?agent=${agent.id}`} />}
            >
              <RouteIcon /> Traces
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/agentops/playground?agent=${agent.id}`} />}
            >
              <SlidersHorizontalIcon /> Open in playground
            </Button>
            <Button variant={agent.health === "Paused" ? "default" : "outline"}>
              <PauseIcon /> {agent.health === "Paused" ? "Resume" : "Pause"}
            </Button>
            <Button>
              <RocketIcon /> Deploy new version
            </Button>
          </>
        }
        overflow={[
          {
            label: "Start experiment",
            icon: <FlaskConicalIcon />,
            href: "/agentops/experiments",
          },
          {
            label: "Edit prompt",
            icon: <WrenchIcon />,
            href: promptHref,
          },
          {
            label: "Export traces",
            message:
              "Export started — you will be notified when the file is ready",
          },
        ]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection title="Evaluation" size="sm">
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="Quality" value={<ScoreBar value={m.quality} />} />
                <Kpi
                  label="Thumbs-down"
                  value={
                    <span
                      className={
                        m.thumbsDownRate > 5 ? "text-danger-text" : undefined
                      }
                    >
                      {m.thumbsDownRate.toFixed(1)}%
                    </span>
                  }
                />
                <Kpi label="Review rate" value={`${m.reviewRate}%`} />
                <Kpi label="Pending reviews" value={pending} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Golden set{" "}
                <code className="rounded-sm bg-muted px-1 font-mono text-[11px]">
                  {agent.evalDataset}
                </code>{" "}
                · prompt{" "}
                <Link
                  href={promptHref}
                  className="rounded-sm bg-muted px-1 font-mono text-[11px] hover:underline"
                >
                  {agent.promptVersion}
                </Link>
              </p>
            </RecordSection>
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
                      "—"
                    ),
                  },
                  {
                    label: "Tools",
                    value: (
                      <span className="flex flex-wrap gap-1">
                        {agent.tools.map((t) => (
                          <code
                            key={t}
                            className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px]"
                          >
                            {t}
                          </code>
                        ))}
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
                    render={<Link href="/agentops/drift" />}
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
                        href="/agentops/recommendations"
                        className="hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className="block text-[11px] text-muted-foreground">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            size="sm"
            label="Requests · 24h"
            value={formatNumber(m.requests24h)}
            hint={`${fmtTokens(m.tokens24h)} tokens`}
          />
          <StatCard
            size="sm"
            label="Latency p95"
            value={fmtMs(m.p95Ms)}
            hint={`p50 ${fmtMs(m.p50Ms)}`}
          />
          <StatCard
            size="sm"
            label="Error rate"
            value={`${m.errorRate.toFixed(1)}%`}
            upIsGood={false}
            hint={m.errorRate > 3 ? "Above 3% threshold" : "Within threshold"}
          />
          <StatCard
            size="sm"
            label="Cost · day"
            value={fmtCost(m.costPerDay, 0)}
            hint={`${fmtCost(m.requests24h ? m.costPerDay / m.requests24h : 0, 3)} per request`}
          />
        </div>

        <RecordSection
          title="Graph"
          description={`${agent.framework} state graph · ${agent.graph.length} nodes`}
          icon={<GitForkIcon />}
        >
          <AgentGraph nodes={agent.graph} />
        </RecordSection>

        <RecordTabs
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

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
}
