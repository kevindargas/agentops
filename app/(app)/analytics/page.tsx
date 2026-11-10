import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarIcon,
  LightbulbIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AvailabilityBar,
  toneForScore,
} from "@/components/charts/availability-bar"
import { ChartCard } from "@/components/charts/chart-card"
import { DonutChart } from "@/components/charts/donut-chart"
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { resolvePeriod } from "@/components/charts/period"
import { PeriodSelect } from "@/components/charts/period-select"
import { Sparkline } from "@/components/charts/sparkline"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import {
  changes,
  createRng,
  daysAgo,
  getGroup,
  incidents,
  NOW,
} from "@/lib/data"
import { formatPercent } from "@/lib/format"

export const metadata: Metadata = { title: "Analytics" }

function Insight({
  icon,
  tone = "neutral",
  title,
  children,
}: {
  icon: React.ReactNode
  tone?: "good" | "warn" | "neutral"
  title: string
  children: React.ReactNode
}) {
  const toneClass =
    tone === "good"
      ? "bg-success/10 text-success-text"
      : tone === "warn"
        ? "bg-warning/15 text-warning-text"
        : "bg-muted text-muted-foreground"
  return (
    <li className="flex gap-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4 ${toneClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </li>
  )
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const period = resolvePeriod((await searchParams).period)
  const days = period.days
  const since = new Date(NOW.getTime() - days * 86_400_000)

  // Deterministic daily flow for the selected window.
  const rng = createRng(7 + days)
  const trend = Array.from({ length: days }, (_, i) => {
    const date = daysAgo(days - 1 - i).slice(0, 10)
    const weekend = [0, 6].includes(new Date(date).getUTCDay())
    const base = weekend ? 12 : 36
    return {
      date,
      opened: Math.round(base + rng() * 20),
      resolved: Math.round(base - 1 + rng() * 20),
    }
  })
  const totalOpened = trend.reduce((a, d) => a + d.opened, 0)
  const totalResolved = trend.reduce((a, d) => a + d.resolved, 0)
  const net = totalOpened - totalResolved
  const peak = trend.reduce(
    (best, d) => (d.opened > best.opened ? d : best),
    trend[0]
  )
  const weekendShare = Math.round(
    (trend
      .filter((d) => [0, 6].includes(new Date(d.date).getUTCDay()))
      .reduce((a, d) => a + d.opened, 0) /
      Math.max(1, totalOpened)) *
      100
  )

  // Change throughput, bucketed daily for 7d and weekly otherwise.
  const buckets = days <= 7 ? days : Math.ceil(days / 7)
  const weekly = Array.from({ length: buckets }, (_, i) => {
    const start = daysAgo(days <= 7 ? days - 1 - i : (buckets - 1 - i) * 7)
    const scale = days <= 7 ? 0.2 : 1
    return {
      name: new Date(start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      standard: Math.round((6 + rng() * 6) * scale),
      normal: Math.round((4 + rng() * 6) * scale),
      emergency: Math.round(rng() * 3 * scale),
    }
  })
  const changeTotal = weekly.reduce(
    (a, w) => a + w.standard + w.normal + w.emergency,
    0
  )
  const emergencyShare = Math.round(
    (weekly.reduce((a, w) => a + w.emergency, 0) / Math.max(1, changeTotal)) *
      100
  )

  const inWindow = incidents.filter((i) => new Date(i.opened) >= since)
  const byChannel = Object.entries(
    inWindow.reduce<Record<string, number>>(
      (acc, i) => ((acc[i.channel] = (acc[i.channel] ?? 0) + 1), acc),
      {}
    )
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const byCategory = Object.entries(
    inWindow.reduce<Record<string, number>>(
      (acc, i) => ((acc[i.category] = (acc[i.category] ?? 0) + 1), acc),
      {}
    )
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const selfService = inWindow.filter((i) =>
    ["Self-service", "Chat"].includes(i.channel)
  ).length
  const selfServicePct = Math.round(
    (selfService / Math.max(1, inWindow.length)) * 100
  )

  const groupStats = Object.values(
    incidents.reduce<
      Record<
        string,
        {
          name: string
          total: number
          resolved: number
          met: number
          open: number
        }
      >
    >((acc, i) => {
      const g = (acc[i.assignmentGroupId] ??= {
        name: getGroup(i.assignmentGroupId)?.name ?? i.assignmentGroupId,
        total: 0,
        resolved: 0,
        met: 0,
        open: 0,
      })
      g.total++
      if (i.resolved) {
        g.resolved++
        if (!i.slaBreached) g.met++
      } else if (!["Canceled"].includes(i.state)) g.open++
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total)
  const bestGroup = [...groupStats]
    .filter((g) => g.resolved >= 3)
    .sort((a, b) => b.met / b.resolved - a.met / a.resolved)[0]

  const closed = changes.filter((c) => c.state === "Closed").length
  const canceled = changes.filter((c) => c.state === "Canceled").length
  const backedOut = Math.max(1, Math.round(closed * 0.06))
  const changeSuccess = Math.round(
    ((closed - backedOut) / Math.max(1, closed + canceled)) * 100
  )
  const stageOf = (state: string) =>
    ["New", "Assess", "Authorize"].includes(state)
      ? "pipeline"
      : state === "Scheduled"
        ? "scheduled"
        : ["Implement", "Review"].includes(state)
          ? "implementing"
          : state === "Closed"
            ? "closed"
            : "canceled"
  const stageCount = (stage: string) =>
    changes.filter((c) => stageOf(c.state) === stage).length
  const pipeline = [
    {
      key: "pipeline",
      label: "Awaiting approval",
      value: stageCount("pipeline"),
      color: "var(--chart-1)",
    },
    {
      key: "scheduled",
      label: "Scheduled",
      value: stageCount("scheduled"),
      color: "var(--chart-3)",
    },
    {
      key: "implementing",
      label: "Implementing",
      value: stageCount("implementing"),
      color: "var(--chart-2)",
    },
    {
      key: "closed",
      label: "Closed",
      value: stageCount("closed"),
      color: "var(--chart-4)",
    },
    {
      key: "canceled",
      label: "Canceled",
      value: stageCount("canceled"),
      color: "var(--chart-5)",
    },
  ].filter((d) => d.value > 0)
  const awaitingCab = changes.filter(
    (c) => c.cabRequired && c.state === "Authorize"
  ).length

  // KPI sparklines (12 points) for the tiles.
  const spark = (start: number, drift: number, noise: number) => {
    let v = start
    return Array.from(
      { length: 12 },
      () => ((v += drift + (rng() - 0.5) * noise), Math.round(v * 10) / 10)
    )
  }
  const sparks = {
    mttr: spark(7.4, -0.08, 0.6),
    fcr: spark(56, 0.4, 2),
    success: spark(changeSuccess - 3, 0.25, 1.2),
    self: spark(selfServicePct - 6, 0.5, 2),
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Performance across incident, change and request management. Figures cover the ${period.label.toLowerCase()} unless noted.`}
        actions={
          <Suspense fallback={<Skeleton className="h-8 w-40 rounded-lg" />}>
            <PeriodSelect value={period.value} />
          </Suspense>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mean time to resolve"
          value="6.4h"
          delta={-11}
          upIsGood={false}
          deltaLabel="vs previous period"
          hint="P1–P3 incidents"
        >
          <Sparkline data={sparks.mttr} className="h-9 w-full" />
        </StatCard>
        <StatCard
          label="First contact resolution"
          value="61%"
          delta={4}
          deltaLabel="vs previous period"
          hint="Resolved by Service Desk on first touch"
        >
          <Sparkline data={sparks.fcr} className="h-9 w-full" />
        </StatCard>
        <StatCard
          label="Change success rate"
          value={`${changeSuccess}%`}
          delta={2}
          deltaLabel="vs previous period"
          hint="Closed without backout"
        >
          <Sparkline
            data={sparks.success}
            className="h-9 w-full"
            baseline={95}
          />
        </StatCard>
        <StatCard
          label="Self-service adoption"
          value={`${selfServicePct}%`}
          delta={7}
          deltaLabel="vs previous period"
          hint="Incidents via portal or chat"
        >
          <Sparkline data={sparks.self} className="h-9 w-full" />
        </StatCard>
      </div>

      <Section
        title="Incident flow"
        description="How demand arrives and how quickly it is worked down"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Incident volume"
            description={`Opened vs resolved per day, ${period.label.toLowerCase()}`}
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/itsm/incidents" />}
              >
                Open incidents <ArrowRightIcon />
              </Button>
            }
          >
            <IncidentTrendChart data={trend} height={272} />
          </ChartCard>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-4">
              <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <LightbulbIcon className="size-3.5" /> Insights
              </p>
              <ul className="flex flex-col gap-4">
                <Insight
                  icon={net <= 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
                  tone={net <= 0 ? "good" : "warn"}
                  title={
                    net <= 0
                      ? `Backlog down ${Math.abs(net)} `
                      : `Backlog up ${net}`
                  }
                >
                  {totalResolved.toLocaleString()} resolved against{" "}
                  {totalOpened.toLocaleString()} opened. Resolution kept pace on{" "}
                  {trend.filter((d) => d.resolved >= d.opened).length} of {days}{" "}
                  days.
                </Insight>
                <Insight
                  icon={<CalendarIcon />}
                  title={`Peak day: ${new Date(peak.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}`}
                >
                  {peak.opened} incidents opened,{" "}
                  {Math.round(
                    ((peak.opened - totalOpened / days) /
                      (totalOpened / days)) *
                      100
                  )}
                  % above the daily average of {Math.round(totalOpened / days)}.
                </Insight>
                <Insight
                  icon={<UsersIcon />}
                  tone="neutral"
                  title={`${weekendShare}% of demand lands on weekends`}
                >
                  Weekend volume is handled by the on-call rotation.{" "}
                  {weekendShare > 20
                    ? "Consider extending Service Desk coverage."
                    : "Current on-call coverage is sufficient."}
                </Insight>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title="Demand mix"
        description="Where incidents come from and what they are about"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Incidents by channel"
            description="How work reaches the Service Desk"
            footer={`${selfServicePct}% arrived through self-service or chat`}
          >
            <HorizontalBarChart
              data={byChannel}
              label="Incidents"
              emphasize={byChannel[0]?.name}
              rowHeight={34}
              emptyDescription="No incidents opened in this period."
            />
          </ChartCard>
          <ChartCard
            title="Incidents by category"
            description="Top-level category at time of logging"
            footer={
              byCategory[0]
                ? `${byCategory[0].name} is the largest category at ${Math.round((byCategory[0].value / Math.max(1, inWindow.length)) * 100)}%`
                : undefined
            }
          >
            <HorizontalBarChart
              data={byCategory}
              label="Incidents"
              color="var(--chart-1)"
              rowHeight={34}
              emptyDescription="No incidents opened in this period."
            />
          </ChartCard>
        </div>
      </Section>

      <Section
        title="Change management"
        description="Throughput and outcomes of the change process"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title={
              days <= 7
                ? "Changes implemented per day"
                : "Changes implemented per week"
            }
            description="By change type"
            footer={
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${emergencyShare <= 10 ? "bg-success" : "bg-warning"}`}
                  aria-hidden
                />
                {emergencyShare}% of {changeTotal} changes were emergency
                changes{" "}
                {emergencyShare <= 10
                  ? "— within the 10% target"
                  : "— above the 10% target"}
              </span>
            }
          >
            <StackedBarChart
              data={weekly}
              height={260}
              series={[
                { key: "standard", label: "Standard", color: "var(--chart-1)" },
                { key: "normal", label: "Normal", color: "var(--chart-2)" },
                {
                  key: "emergency",
                  label: "Emergency",
                  color: "var(--chart-3)",
                },
              ]}
            />
          </ChartCard>
          <ChartCard
            title="Change pipeline"
            description="All changes by lifecycle stage"
            footer={`${awaitingCab} change${awaitingCab === 1 ? "" : "s"} waiting on CAB · ${changeSuccess}% success rate on closed changes`}
          >
            <DonutChart
              data={pipeline}
              centerLabel="changes"
              height={176}
              legend="bottom"
            />
          </ChartCard>
        </div>
      </Section>

      <Section
        title="Team performance"
        description="Resolution SLA attainment per assignment group, trailing 90 days"
      >
        <ChartCard
          title="Assignment groups"
          description="Volume, open backlog and SLA attainment"
          footer={
            bestGroup
              ? `${bestGroup.name} leads with ${formatPercent((bestGroup.met / bestGroup.resolved) * 100, 0)} attainment on ${bestGroup.resolved} resolved incidents`
              : undefined
          }
        >
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Group</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-right text-xs">Open</TableHead>
                  <TableHead className="text-right text-xs">Resolved</TableHead>
                  <TableHead className="text-right text-xs">SLA met</TableHead>
                  <TableHead className="w-56 text-xs">Attainment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupStats.map((g) => {
                  const pct = g.resolved ? (g.met / g.resolved) * 100 : 0
                  return (
                    <TableRow key={g.name} className="text-sm">
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.total}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.open}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.resolved}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.met}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <AvailabilityBar
                            value={pct}
                            target={90}
                            tone={toneForScore(pct, { good: 90, ok: 75 })}
                            size="sm"
                            className="flex-1"
                          />
                          <span className="w-10 text-right text-xs tabular-nums">
                            {formatPercent(pct, 0)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      </Section>
    </>
  )
}
