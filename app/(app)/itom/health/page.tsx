import type { Metadata } from "next"
import { ActivityIcon, AlertTriangleIcon, GitBranchIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AvailabilityBar,
  type MeterTone,
} from "@/components/charts/availability-bar"
import { Sparkline } from "@/components/charts/sparkline"
import { UptimeStrip, type UptimeDay } from "@/components/charts/uptime-strip"
import { MetricTile } from "@/components/shared/metric-tile"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { availabilitySlo, serviceHealth } from "@/lib/data/itom"
import { createRng, daysAgo } from "@/lib/data/seed"
import { formatPercent } from "@/lib/format"
import type { ServiceHealth } from "@/lib/types"

export const metadata: Metadata = { title: "Service Health" }

type Health = ServiceHealth["health"]

const healthMeta: Record<
  Health,
  {
    accent: string
    dot: string
    tone: Tone
    meter: MeterTone
    spark: string
  }
> = {
  Healthy: {
    accent: "border-l-success",
    dot: "bg-success",
    tone: "success",
    meter: "success",
    spark: "var(--chart-3)",
  },
  Degraded: {
    accent: "border-l-warning",
    dot: "bg-warning",
    tone: "warning",
    meter: "warning",
    spark: "var(--warning)",
  },
  Critical: {
    accent: "border-l-destructive",
    dot: "bg-destructive",
    tone: "danger",
    meter: "danger",
    spark: "var(--destructive)",
  },
  Unknown: {
    accent: "border-l-border",
    dot: "bg-muted-foreground/40",
    tone: "muted",
    meter: "brand",
    spark: "var(--muted-foreground)",
  },
}

const healthOrder: Health[] = ["Critical", "Degraded", "Healthy", "Unknown"]

/** Deterministic 30-day availability history per service, consistent with its current health. */
function buildHistory(s: ServiceHealth, seed: number) {
  const rng = createRng(seed)
  const days: UptimeDay[] = []
  const series: number[] = []
  for (let i = 29; i >= 0; i--) {
    const date = daysAgo(i).slice(0, 10)
    let availability = 99.95 + rng() * 0.05
    if (s.health === "Critical" && (i <= 1 || rng() < 0.12))
      availability = 96 + rng() * 2.5
    else if (s.health === "Degraded" && (i === 0 || rng() < 0.1))
      availability = 99.2 + rng() * 0.6
    else if (rng() < 0.04) availability = 99.5 + rng() * 0.4
    const status: UptimeDay["status"] =
      availability >= availabilitySlo
        ? "up"
        : availability >= 99
          ? "degraded"
          : "down"
    days.push({ date, status, note: `${availability.toFixed(2)}% available` })
    series.push(Math.round(availability * 100) / 100)
  }
  return { days, series }
}

export default function ServiceHealthPage() {
  const counts = healthOrder.map((h) => ({
    health: h,
    count: serviceHealth.filter((s) => s.health === h).length,
  }))
  const healthy = counts.find((c) => c.health === "Healthy")?.count ?? 0
  const avgAvailability =
    serviceHealth.reduce((a, s) => a + s.availability30d, 0) /
    serviceHealth.length
  const withAlerts = serviceHealth.filter((s) => s.openAlerts > 0).length
  const belowSlo = serviceHealth.filter(
    (s) => s.availability30d < availabilitySlo
  ).length
  const sorted = [...serviceHealth].sort(
    (a, b) =>
      healthOrder.indexOf(a.health) - healthOrder.indexOf(b.health) ||
      a.name.localeCompare(b.name)
  )

  return (
    <>
      <PageHeader
        nav="/itom/health"
        description="Current health of business services, derived from alerts, incidents and changes on the systems and services they depend on."
      />

      <StatGrid columns={4}>
        <StatCard
          label="Services healthy"
          value={`${healthy}/${serviceHealth.length}`}
          hint={`${serviceHealth.length - healthy} degraded or critical`}
        >
          <div
            className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`${healthy} of ${serviceHealth.length} services healthy`}
          >
            {sorted.map((s) => (
              <span
                key={s.ciId}
                className={`flex-1 ${healthMeta[s.health].dot}`}
                title={`${s.name} · ${s.health}`}
              />
            ))}
          </div>
        </StatCard>
        <StatCard
          label="Avg availability (30d)"
          value={formatPercent(avgAvailability, 2)}
          hint={`${belowSlo} service${belowSlo === 1 ? "" : "s"} below the ${availabilitySlo}% SLO`}
        >
          <AvailabilityBar
            value={avgAvailability}
            min={99}
            max={100}
            target={availabilitySlo}
            tone={avgAvailability >= availabilitySlo ? "success" : "warning"}
            size="sm"
            className="w-full"
          />
        </StatCard>
        <StatCard
          label="Services with open alerts"
          value={withAlerts}
          upIsGood={false}
          hint={`${serviceHealth.reduce((a, s) => a + s.openAlerts, 0)} open alerts in total`}
        />
        <StatCard
          label="Changes in flight"
          value={serviceHealth.reduce((a, s) => a + s.activeChanges, 0)}
          hint="Scheduled or implementing against these services"
        />
      </StatGrid>

      <Section
        title="Status overview"
        description="Service count by health state"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {counts.map((c) => (
            <MetricTile
              key={c.health}
              label={c.health}
              value={c.count}
              tone={c.count > 0 ? healthMeta[c.health].tone : "muted"}
              unit={c.count === 1 ? "service" : "services"}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Business services"
        description={`Sorted by severity · availability target ${availabilitySlo}%`}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s, idx) => {
            const meta = healthMeta[s.health]
            const { days, series } = buildHistory(s, 990 + idx)
            return (
              <Card key={s.ciId} className={`h-full border-l-4 ${meta.accent}`}>
                <CardHeader>
                  <CardTitle className="truncate">{s.name}</CardTitle>
                  <CardDescription>
                    <UserChip userId={s.owner} size="xs" />
                  </CardDescription>
                  <CardAction>
                    <StateBadge state={s.health} />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Availability (30d)
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {formatPercent(s.availability30d, 2)}
                      </p>
                    </div>
                    <Sparkline
                      data={series}
                      color={meta.spark}
                      className="h-10 w-32"
                      baseline={availabilitySlo}
                      domain={[Math.min(95, ...series), 100]}
                    />
                  </div>
                  <AvailabilityBar
                    value={s.availability30d}
                    min={99}
                    max={100}
                    target={availabilitySlo}
                    tone={meta.meter}
                    size="sm"
                    label={`vs ${availabilitySlo}% target`}
                    valueLabel={
                      s.availability30d >= availabilitySlo
                        ? `+${(s.availability30d - availabilitySlo).toFixed(2)} pts`
                        : `${(s.availability30d - availabilitySlo).toFixed(2)} pts`
                    }
                  />
                  <UptimeStrip days={days} size="sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <MetricTile
                      label="Alerts"
                      icon={<ActivityIcon />}
                      value={s.openAlerts}
                      tone={s.openAlerts > 0 ? "warning" : "muted"}
                    />
                    <MetricTile
                      label="Incidents"
                      icon={<AlertTriangleIcon />}
                      value={s.openIncidents}
                      tone={s.openIncidents > 0 ? "danger" : "muted"}
                    />
                    <MetricTile
                      label="Changes"
                      icon={<GitBranchIcon />}
                      value={s.activeChanges}
                      tone={s.activeChanges > 0 ? "neutral" : "muted"}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </Section>
    </>
  )
}
