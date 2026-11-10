"use client"

import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { getChange } from "@/lib/data/itsm"
import { NOW } from "@/lib/data/seed"
import { approvalsStore, pendingApprovals } from "./approvals-store"

/**
 * KPI row for the approvals inbox. Reads the shared approvals store so the
 * numbers move the moment a decision is recorded in the list below.
 */
export function ApprovalsStats() {
  const pending = pendingApprovals(approvalsStore.use())
  const changeApprovals = pending.filter((a) => a.recordType === "Change")
  const requestApprovals = pending.filter((a) => a.recordType === "Request")
  const dueSoon = pending.filter(
    (a) => new Date(a.due).getTime() - NOW.getTime() < 36 * 3_600_000
  ).length
  const highRisk = changeApprovals.filter((a) => {
    const risk = getChange(a.recordNumber)?.risk
    return risk === "High" || risk === "Very High"
  }).length
  return (
    <StatGrid columns={4}>
      <StatCard
        label="Pending"
        value={pending.length}
        hint="Routed to you as approver"
      />
      <StatCard
        label="Due within 36h"
        value={dueSoon}
        upIsGood={false}
        hint="Decide soon to keep work moving"
      />
      <StatCard
        label="Changes"
        value={changeApprovals.length}
        hint={`${highRisk} high or very high risk`}
      />
      <StatCard
        label="Requests"
        value={requestApprovals.length}
        hint="Catalog items awaiting manager approval"
      />
    </StatGrid>
  )
}
