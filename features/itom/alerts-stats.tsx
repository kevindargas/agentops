"use client"

import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { openAlertDelta } from "@/lib/data/metrics"
import { formatNumber, formatPercent } from "@/lib/format"
import { alertsStore, openAlerts } from "./alerts-store"

/**
 * KPI row for the alerts page. Reads the same client store as the table so
 * acknowledging, closing or promoting alerts moves the numbers immediately.
 */
export function AlertsStats() {
  const list = alertsStore.use()
  const open = openAlerts(list)
  const critical = open.filter((a) => a.severity === "Critical").length
  const unacked = open.filter((a) => !a.acknowledged).length
  const promoted = open.filter((a) => a.incidentNumber).length
  const events = open.reduce((sum, a) => sum + a.count, 0)
  const noiseReduction =
    events === 0 ? 0 : Math.max(0, (1 - open.length / events) * 100)
  const delta = openAlertDelta(14)

  return (
    <StatGrid columns={4}>
      <StatCard
        label="Open alerts"
        value={open.length}
        upIsGood={false}
        delta={delta.delta}
        deltaUnit=""
        deltaLabel="vs 14 days ago"
        hint={`${promoted} promoted to incidents`}
      />
      <StatCard
        label="Critical"
        value={critical}
        upIsGood={false}
        hint="Require immediate action"
      />
      <StatCard
        label="Unacknowledged"
        value={unacked}
        upIsGood={false}
        hint="Nobody has taken ownership yet"
      />
      <StatCard
        label="Noise reduction"
        value={formatPercent(noiseReduction, 1)}
        hint={`${formatNumber(events)} events correlated into ${open.length} alert${open.length === 1 ? "" : "s"}`}
      />
    </StatGrid>
  )
}
