import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRightIcon,
  BellIcon,
  BotIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClockIcon,
  GitBranchIcon,
  InboxIcon,
  PackageIcon,
  RadioIcon,
  WavesIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartCard } from "@/components/charts/chart-card"
import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { PriorityBadge, StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { AgentProposalsCard } from "@/features/ai/agent-proposals-card"
import {
  FleetTrafficChart,
  SpendByAgentChart,
} from "@/features/workspace/fleet-charts"
import { priorityLabels, slaComplianceTarget } from "@/lib/constants"
import {
  agentTraces,
  alerts,
  changes,
  createRng,
  daysAgo,
  deployedAgents,
  driftSignals,
  experiments,
  fleetDaily,
  getCi,
  getDeployedAgent,
  getGroup,
  incidents,
  modelRecommendations,
  pendingApprovalCount,
  requests,
  reviewItems,
  serviceHealth,
  NOW,
} from "@/lib/data"
import { openIncidentDelta, slaComplianceDelta } from "@/lib/data/metrics"
import { currentUser } from "@/lib/data/users"
import {
  formatCost,
  formatDateTime,
  formatNumber,
  formatPercent,
  timeAgo,
} from "@/lib/format"
import type { DriftSeverity, Priority } from "@/lib/types"

export const metadata: Metadata = { title: "Overview" }

function buildTrend() {
  const rng = createRng(42)
  return Array.from({ length: 30 }, (_, i) => {
    const date = daysAgo(29 - i).slice(0, 10)
    const weekend = [0, 6].includes(new Date(date).getUTCDay())
    const base = weekend ? 14 : 38
    const opened = Math.round(base + rng() * 18)
    const resolved = Math.round(base - 2 + rng() * 20)
    return { date, opened, resolved }
  })
}

/**
 * 14-point KPI sparklines, deterministic so SSR and CSR agree. Each walk is
 * anchored so its last point equals the figure shown beside it.
 */
function buildSparks(openNow: number, slaNow: number) {
  const rng = createRng(1106)
  const walk = (end: number, drift: number, noise: number, digits = 1) => {
    const steps = Array.from(
      { length: 13 },
      () => drift + (rng() - 0.5) * noise
    )
    const total = steps.reduce((a, b) => a + b, 0)
    let v = end - total
    const factor = 10 ** digits
    const points = [Math.round(v * factor) / factor]
    for (const step of steps) {
      v += step
      points.push(Math.round(v * factor) / factor)
    }
    points[points.length - 1] = end
    return points
  }
  return {
    open: walk(openNow, -0.4, 4, 0),
    sla: walk(slaNow, 0.12, 0.8),
  }
}

function greeting(date: Date) {
  const h = date.getUTCHours()
  if (h < 5) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

const alertDot: Record<string, string> = {
  Critical: "bg-destructive",
  Major: "bg-warning",
  Minor: "bg-info",
}

const driftRank: Record<DriftSeverity, number> = {
  Critical: 0,
  Warning: 1,
  Info: 2,
}

/** Consistent hover row for dashboard lists: content, optional trailing meta, chevron on hover. */
function ListRow({
  href,
  children,
  trailing,
}: {
  href: string
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      {children}
      {trailing}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  )
}

function ListEmpty({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <EmptyState
      size="sm"
      bare
      icon={icon}
      title={title}
      description={description}
    />
  )
}

export default function DashboardPage() {
  /* ---- Agent operations ------------------------------------------------ */
  const live = deployedAgents.filter((a) => a.environment === "production")
  const unhealthy = live
    .filter((a) => a.health !== "Healthy")
    .sort((a, b) => b.driftScore - a.driftScore)
  const requests24h = live.reduce((s, a) => s + a.metrics.requests24h, 0)
  const fleetQuality =
    Math.round(
      (live.reduce((s, a) => s + a.metrics.quality * a.metrics.requests24h, 0) /
        Math.max(1, requests24h)) *
        10
    ) / 10
  const spendToday = live.reduce((s, a) => s + a.metrics.costPerDay, 0)
  const last7 = fleetDaily.slice(-7)
  const prev7 = fleetDaily.slice(-14, -7)
  const avg = (rows: typeof fleetDaily, k: "cost" | "quality") =>
    rows.reduce((s, r) => s + r[k], 0) / Math.max(1, rows.length)
  const spendDelta =
    Math.round(
      ((avg(last7, "cost") - avg(prev7, "cost")) / avg(prev7, "cost")) * 1000
    ) / 10
  const qualityDelta =
    Math.round((avg(last7, "quality") - avg(prev7, "quality")) * 10) / 10
  const pendingReviews = reviewItems
    .filter((r) => r.status === "Pending")
    .sort(
      (a, b) => a.priority - b.priority || b.created.localeCompare(a.created)
    )
  const urgentReviews = pendingReviews.filter((r) => r.priority <= 2).length
  const openDrift = driftSignals
    .filter((d) => d.state !== "Resolved")
    .sort((a, b) => driftRank[a.severity] - driftRank[b.severity])
  const criticalDrift = openDrift.filter(
    (d) => d.severity === "Critical"
  ).length
  const dayAgo = NOW.getTime() - 86_400_000
  const traces24h = agentTraces.filter(
    (t) => new Date(t.startedAt).getTime() > dayAgo
  )
  const failingEvals = traces24h.filter(
    (t) =>
      t.status === "Failed" ||
      t.evals.grounded < 0.6 ||
      t.evals.helpful < 0.6 ||
      t.evals.safe < 0.6
  )
  const failingByAgent = Object.entries(
    failingEvals.reduce<Record<string, number>>((acc, t) => {
      acc[t.agentId] = (acc[t.agentId] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])
  const running = experiments.filter((e) => e.status === "Running")
  const newRecs = modelRecommendations.filter((r) => r.status === "New")
  const spendByAgent = [...live]
    .sort((a, b) => b.metrics.costPerDay - a.metrics.costPerDay)
    .map((a) => ({
      name: a.name,
      value: Math.round(a.metrics.costPerDay),
    }))
  const traffic = fleetDaily.map((d, i) => ({
    date: daysAgo(fleetDaily.length - 1 - i).slice(0, 10),
    requests: d.requests,
    reviewed: d.reviewed,
  }))

  /* ---- Service management (secondary) --------------------------------- */
  const open = incidents.filter(
    (i) => !["Resolved", "Closed", "Canceled"].includes(i.state)
  )
  const breached = open.filter((i) => i.slaBreached).length
  const highPriority = open.filter((i) => i.priority <= 2).length
  const slaMet = incidents.filter((i) => i.resolved && !i.slaBreached).length
  const slaTotal = incidents.filter((i) => i.resolved).length
  const openRequests = requests.filter((r) => !r.state.startsWith("Closed"))
  const upcomingChanges = changes
    .filter(
      (c) =>
        ["Scheduled", "Authorize", "Implement"].includes(c.state) &&
        new Date(c.plannedStart) > new Date(NOW.getTime() - 86_400_000)
    )
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
    .slice(0, 5)
  const openAlerts = alerts.filter((a) => a.state !== "Closed")
  const byPriority = ([1, 2, 3, 4, 5] as Priority[]).map((p) => ({
    name: `P${p} · ${priorityLabels[p]}`,
    value: open.filter((i) => i.priority === p).length,
  }))
  const majors = open.filter((i) => i.majorIncident)
  const lead = majors[0]
  const leadService = lead?.ciId ? getCi(lead.ciId) : undefined
  const myWork = [
    ...open.filter((i) => i.assignedToId === currentUser.id),
  ].slice(0, 5)
  const slaPct = Math.round((slaMet / Math.max(1, slaTotal)) * 1000) / 10
  const trend = buildTrend()
  const sparks = buildSparks(open.length, slaPct)
  const incidentDelta = openIncidentDelta(14)
  const slaDelta = slaComplianceDelta(14)
  const netBacklog = trend
    .slice(-7)
    .reduce((acc, d) => acc + d.opened - d.resolved, 0)
  const degraded = serviceHealth.filter((s) => s.health !== "Healthy").length

  return (
    <>
      <PageHeader
        nav="/dashboard"
        size="lg"
        title={`${greeting(NOW)}, ${currentUser.name.split(" ")[0]}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {NOW.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
            <span className="tabular-nums">
              {live.length} agents in production,{" "}
              {unhealthy.length === 0
                ? "all healthy"
                : `${unhealthy.length} need${unhealthy.length === 1 ? "s" : ""} attention`}
            </span>
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
            <span className="tabular-nums">
              {open.length} open incidents, {highPriority} high priority
            </span>
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
            <span className="tabular-nums">
              {degraded === 0
                ? "All services healthy"
                : `${degraded} service${degraded === 1 ? "" : "s"} degraded`}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href="/agentops" />}>
              Fleet Overview
            </Button>
            <Button render={<Link href="/agentops/reviews" />}>
              <ClipboardCheckIcon /> Review Queue
            </Button>
          </>
        }
      />

      {lead && (
        <section
          aria-label="Major incident"
          className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-destructive/30 bg-linear-to-r from-destructive/10 via-destructive/5 to-card p-4 pl-5 sm:flex-row sm:items-center"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 bg-destructive"
          />
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-destructive/25 [animation-duration:2.4s]"
            />
            <span className="relative flex size-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <RadioIcon className="size-5" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-danger-text">
                {majors.length === 1
                  ? "Major incident in progress"
                  : `${majors.length} major incidents in progress`}
              </p>
              <PriorityBadge priority={lead.priority} short />
              <StateBadge state={lead.state} dot={false} />
            </div>
            <p className="mt-0.5 truncate text-sm">
              <span className="font-medium tabular-nums">{lead.number}</span>{" "}
              <span className="text-muted-foreground">·</span>{" "}
              {lead.shortDescription}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ClockIcon className="size-3.5" /> Opened {timeAgo(lead.opened)}
              </span>
              {leadService && <span>Affects {leadService.name}</span>}
              <span>
                {getGroup(lead.assignmentGroupId)?.name ?? "Unassigned"}
              </span>
              {majors.length > 1 && (
                <Link
                  href="/itsm/incidents?view=major"
                  className="underline-offset-4 hover:underline"
                >
                  +{majors.length - 1} more
                </Link>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/itsm/incidents/${lead.number}`} />}
            >
              View incident
            </Button>
            <Button
              size="sm"
              render={<Link href={`/itsm/incidents/${lead.number}`} />}
            >
              Join bridge <ArrowRightIcon />
            </Button>
          </div>
        </section>
      )}

      {/* ---- Agent-ops signals ------------------------------------------- */}
      <StatGrid columns={5}>
        <StatCard
          label="Fleet health"
          value={`${live.length - unhealthy.length}/${live.length}`}
          unit="healthy"
          href="/agentops/agents"
          delta={qualityDelta}
          deltaUnit="pt"
          deltaLabel="quality vs prior week"
          hint={`Composite quality ${fleetQuality} · ${formatNumber(requests24h, true)} requests today`}
        >
          <Sparkline
            data={fleetDaily.slice(-14).map((d) => d.quality)}
            color="var(--chart-1)"
            className="h-9 w-full"
          />
        </StatCard>
        <StatCard
          label="Spend today"
          value={formatCost(spendToday, 0)}
          href="/agentops/recommendations"
          delta={spendDelta}
          upIsGood={false}
          deltaLabel="vs prior week"
          hint={`${newRecs.length} new cost recommendation${newRecs.length === 1 ? "" : "s"}`}
        >
          <Sparkline
            data={fleetDaily.slice(-14).map((d) => d.cost)}
            color="var(--chart-1)"
            className="h-9 w-full"
          />
        </StatCard>
        <StatCard
          label="Review queue"
          value={pendingReviews.length}
          href="/agentops/reviews"
          hint={`${urgentReviews} high priority · ${pendingReviews.filter((r) => r.assignedToId === currentUser.id).length} assigned to you`}
        >
          <Sparkline
            data={fleetDaily.slice(-14).map((d) => d.reviewed)}
            color="var(--chart-1)"
            className="h-9 w-full"
          />
        </StatCard>
        <StatCard
          label="Open drift signals"
          value={openDrift.length}
          href="/agentops/drift"
          upIsGood={false}
          hint={`${criticalDrift} critical · ${openDrift.filter((d) => d.state === "Acknowledged").length} acknowledged`}
        />
        <StatCard
          label="Failing evals (24h)"
          value={failingEvals.length}
          href="/agentops/traces?status=Failed"
          upIsGood={false}
          hint={
            failingByAgent[0]
              ? `${failingByAgent[0][1]} on ${getDeployedAgent(failingByAgent[0][0])?.name ?? failingByAgent[0][0]} · ${running.length} experiment${running.length === 1 ? "" : "s"} running`
              : `${running.length} experiment${running.length === 1 ? "" : "s"} running`
          }
        >
          <Sparkline
            data={fleetDaily.slice(-14).map((d) => d.errors)}
            color="var(--chart-1)"
            className="h-9 w-full"
          />
        </StatCard>
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Fleet traffic"
          description="Requests per day across production agents, with the share sampled into human review, last 30 days"
          footer={
            <span className="flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${qualityDelta >= 0 ? "bg-success" : "bg-warning"}`}
                aria-hidden
              />
              {qualityDelta >= 0
                ? `Quality held at ${avg(last7, "quality").toFixed(1)} this week`
                : `Quality slipped ${Math.abs(qualityDelta).toFixed(1)} pts this week: ${openDrift[0] ? `${openDrift[0].metric} on ${getDeployedAgent(openDrift[0].agentId)?.name}` : "see drift signals"}`}
            </span>
          }
        >
          <FleetTrafficChart data={traffic} />
        </ChartCard>
        <ChartCard
          title="Spend by agent"
          description="Cost per day, production agents"
          footer={
            spendByAgent[0]
              ? `${spendByAgent[0].name} is ${Math.round((spendByAgent[0].value / Math.max(1, spendToday)) * 100)}% of today's spend`
              : undefined
          }
        >
          <SpendByAgentChart data={spendByAgent} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Agents needing attention</CardTitle>
            <CardDescription>
              Drifting, degraded or paused in production
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/agentops/agents" />}
              >
                All agents <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col divide-y">
            {unhealthy.length === 0 && (
              <ListEmpty
                icon={<BotIcon />}
                title="Every agent is healthy"
                description="No drift, error or quality thresholds are tripped."
              />
            )}
            {unhealthy.map((a) => (
              <ListRow
                key={a.id}
                href={`/agentops/agents/${a.id}`}
                trailing={<StateBadge state={a.health} />}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <BotIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    Quality {a.metrics.quality} · {a.metrics.errorRate}% errors
                    · PSI {a.driftScore.toFixed(2)}
                  </p>
                </div>
              </ListRow>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Review queue</CardTitle>
            <CardDescription>
              Answers waiting for a human verdict
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/agentops/reviews" />}
              >
                Open queue <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col divide-y">
            {pendingReviews.length === 0 && (
              <ListEmpty
                icon={<InboxIcon />}
                title="Queue is empty"
                description="Sampled and flagged answers will appear here."
              />
            )}
            {pendingReviews.slice(0, 5).map((r) => (
              <ListRow
                key={r.id}
                href="/agentops/reviews"
                trailing={
                  <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                    {timeAgo(r.created)}
                  </span>
                }
              >
                <PriorityBadge priority={r.priority} short />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.reason}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {getDeployedAgent(r.agentId)?.name ?? r.agentId} ·{" "}
                    <span className="font-mono">{r.traceId}</span>
                  </p>
                </div>
              </ListRow>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Open drift signals</CardTitle>
            <CardDescription>
              Metrics that moved away from each agent&apos;s baseline
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/agentops/drift" />}
              >
                Drift board <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col divide-y">
            {openDrift.length === 0 && (
              <ListEmpty
                icon={<WavesIcon />}
                title="No open drift"
                description="All agents are within their baselines."
              />
            )}
            {openDrift.slice(0, 5).map((d) => (
              <ListRow
                key={d.id}
                href="/agentops/drift"
                trailing={<StateBadge state={d.severity} dot={false} />}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.metric}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {getDeployedAgent(d.agentId)?.name ?? d.agentId} ·{" "}
                    {d.unit === "$" ? "$" : ""}
                    {d.baseline}
                    {d.unit !== "$" ? d.unit : ""} → {d.unit === "$" ? "$" : ""}
                    {d.current}
                    {d.unit !== "$" ? d.unit : ""}
                  </p>
                </div>
              </ListRow>
            ))}
          </CardContent>
        </Card>
      </div>

      <AgentProposalsCard />

      {/* ---- Service management ------------------------------------------ */}
      <StatGrid columns={4}>
        <StatCard
          label="Open incidents"
          value={open.length}
          delta={incidentDelta.delta}
          deltaUnit=""
          upIsGood={false}
          deltaLabel="vs 14 days ago"
          href="/itsm/incidents"
          hint={`${majors.length} major · ${highPriority} high priority`}
        >
          <Sparkline
            data={sparks.open}
            color="var(--chart-1)"
            className="h-9 w-full"
          />
        </StatCard>
        <StatCard
          label="SLA compliance"
          value={formatPercent(slaPct)}
          delta={slaDelta.delta}
          deltaUnit="pt"
          deltaLabel="vs previous 14 days"
          hint={`${breached} open incident${breached === 1 ? "" : "s"} already breached`}
        >
          <Sparkline
            data={sparks.sla}
            color="var(--chart-1)"
            className="h-9 w-full"
            baseline={slaComplianceTarget}
          />
        </StatCard>
        <StatCard
          label="Service health"
          value={`${serviceHealth.length - degraded}/${serviceHealth.length}`}
          unit="healthy"
          href="/itom/health"
          hint={`${openAlerts.length} open alert${openAlerts.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Pending approvals"
          value={pendingApprovalCount()}
          href="/approvals"
          hint="Changes and requests waiting on a decision"
        />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Incident volume"
          description="Opened vs resolved per day, last 30 days"
          footer={
            <span className="flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${netBacklog <= 0 ? "bg-success" : "bg-warning"}`}
                aria-hidden
              />
              {netBacklog <= 0
                ? `Backlog shrank by ${Math.abs(netBacklog)} over the last 7 days`
                : `Backlog grew by ${netBacklog} over the last 7 days`}
            </span>
          }
        >
          <IncidentTrendChart data={trend} height={CHART_HEIGHT.md} />
        </ChartCard>
        <ChartCard
          title="Open by priority"
          description="Across all assignment groups"
          footer={`${highPriority} of ${open.length} open incidents are P1 or P2`}
        >
          <HorizontalBarChart
            data={byPriority}
            label="Incidents"
            height={CHART_HEIGHT.sm}
            labelWidth={110}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Service health</CardTitle>
            <CardDescription>
              Business services the agents depend on
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/itom/health" />}
              >
                All services <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {serviceHealth.map((s) => (
              <ListRow
                key={s.ciId}
                href="/itom/health"
                trailing={<StateBadge state={s.health} />}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatPercent(s.availability30d, 2)} availability ·{" "}
                    {s.openAlerts} alert{s.openAlerts === 1 ? "" : "s"}
                  </p>
                </div>
              </ListRow>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>My work</CardTitle>
            <CardDescription>Open incidents assigned to you</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/my-work" />}
              >
                View all <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col divide-y">
            {myWork.length === 0 && (
              <ListEmpty
                icon={<InboxIcon />}
                title="You're all caught up"
                description="Nothing assigned to you is open right now."
              />
            )}
            {myWork.map((i) => (
              <ListRow
                key={i.number}
                href={`/itsm/incidents/${i.number}`}
                trailing={
                  <StateBadge
                    state={i.state}
                    dot={false}
                    className="hidden sm:inline-flex"
                  />
                }
              >
                <PriorityBadge priority={i.priority} short />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {i.shortDescription}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {i.number} · updated {timeAgo(i.updated)}
                  </p>
                </div>
              </ListRow>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Upcoming changes</CardTitle>
            <CardDescription>
              Next scheduled implementation windows
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/itsm/changes/calendar" />}
              >
                Calendar <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col divide-y">
            {upcomingChanges.length === 0 && (
              <ListEmpty
                icon={<GitBranchIcon />}
                title="No changes scheduled"
                description="The change calendar is clear for the next few days."
              />
            )}
            {upcomingChanges.map((c) => (
              <ListRow
                key={c.number}
                href={`/itsm/changes/${c.number}`}
                trailing={
                  <StateBadge
                    state={c.state}
                    dot={false}
                    className="hidden sm:inline-flex"
                  />
                }
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <GitBranchIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.shortDescription}
                  </p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(c.plannedStart)} · {c.type} · {c.risk} risk
                  </p>
                </div>
              </ListRow>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Latest alerts and requests across the platform
          </CardDescription>
          <CardAction className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/itom/alerts" />}
            >
              Alerts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/itsm/requests" />}
            >
              Requests
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BellIcon className="size-3.5" /> Open alerts
              <span className="ml-auto tabular-nums">{openAlerts.length}</span>
            </p>
            <div className="flex flex-col divide-y">
              {openAlerts.length === 0 && (
                <ListEmpty icon={<BellIcon />} title="No open alerts" />
              )}
              {openAlerts.slice(0, 5).map((a) => (
                <ListRow key={a.number} href="/itom/alerts">
                  <span
                    className={`size-2 shrink-0 rounded-full ${alertDot[a.severity] ?? "bg-muted-foreground/50"}`}
                    aria-label={a.severity}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.description}</p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {a.node} · {timeAgo(a.opened)}
                    </p>
                  </div>
                </ListRow>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <PackageIcon className="size-3.5" /> Open requests
              <span className="ml-auto tabular-nums">
                {openRequests.length}
              </span>
            </p>
            <div className="flex flex-col divide-y">
              {openRequests.length === 0 && (
                <ListEmpty icon={<PackageIcon />} title="No open requests" />
              )}
              {openRequests.slice(0, 5).map((r) => (
                <ListRow
                  key={r.number}
                  href={`/itsm/requests/${r.number}`}
                  trailing={
                    <StateBadge
                      state={r.state}
                      dot={false}
                      className="hidden sm:inline-flex"
                    />
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm tabular-nums">
                      {r.number} · {r.items.length} item
                      {r.items.length > 1 ? "s" : ""}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <UserChip
                        userId={r.requestedForId}
                        size="xs"
                        className="[&_span]:text-xs"
                      />{" "}
                      · {timeAgo(r.updated)}
                    </p>
                  </div>
                </ListRow>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
