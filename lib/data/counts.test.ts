import { describe, expect, it } from "vitest"

import {
  approvals,
  pendingApprovalCount,
  unreadNotificationCount,
  notifications,
} from "./activity"
import {
  modelRecommendations,
  openDriftCount,
  openRecommendationCount,
  pendingReviewCount,
  reviewItems,
  driftSignals,
} from "./agentops"
import { budgets, budgetsAtRiskCount } from "./costs"
import {
  activeReleaseCount,
  pendingReleaseApprovalCount,
  releaseApprovals,
  releases,
} from "./deployments"
import { alerts, openAlertCount, unacknowledgedAlertCount } from "./itom"
import {
  compareWindows,
  countInWindows,
  fulfilledRequestSpendDelta,
  meanTimeToResolveHours,
  openAlertDelta,
  openCountDelta,
  openIncidentDelta,
  slaComplianceDelta,
  sumInWindows,
} from "./metrics"
import { apiKeys, expiringKeyCount } from "./providers"
import { daysAgo, NOW } from "./seed"

describe("count helpers", () => {
  it("match the selectors the pages use", () => {
    expect(pendingReviewCount()).toBe(
      reviewItems.filter((r) => r.status === "Pending").length
    )
    expect(pendingReviewCount()).toBeGreaterThan(0)
    expect(openRecommendationCount()).toBe(
      modelRecommendations.filter((r) => r.status === "New").length
    )
    expect(openAlertCount()).toBe(
      alerts.filter((a) => a.state !== "Closed").length
    )
    expect(unacknowledgedAlertCount()).toBeLessThanOrEqual(openAlertCount())
    expect(pendingApprovalCount()).toBe(
      approvals.filter((a) => a.state === "Requested").length
    )
    expect(pendingReleaseApprovalCount()).toBe(releaseApprovals.length)
    expect(activeReleaseCount()).toBeGreaterThanOrEqual(
      pendingReleaseApprovalCount()
    )
    expect(activeReleaseCount()).toBe(
      releases.filter((r) =>
        ["Canary", "Progressing", "Pending approval"].includes(r.stage)
      ).length
    )
    expect(budgetsAtRiskCount()).toBe(
      budgets.filter((b) => b.status !== "On track").length
    )
    expect(openDriftCount()).toBe(
      driftSignals.filter((s) => s.state !== "Resolved").length
    )
    expect(openDriftCount("agt-it-helpdesk")).toBeGreaterThan(0)
    expect(unreadNotificationCount()).toBe(
      notifications.filter((n) => !n.read).length
    )
    expect(expiringKeyCount(365)).toBeGreaterThan(0)
    expect(expiringKeyCount(0)).toBeLessThanOrEqual(
      apiKeys.filter((k) => k.status === "Expiring").length + 1
    )
  })

  it("accept an explicit list so optimistic UI state can be recounted", () => {
    const approved = reviewItems.map((r) => ({
      ...r,
      status: "Approved" as const,
    }))
    expect(pendingReviewCount(approved)).toBe(0)
    expect(openAlertCount(alerts.filter((a) => a.state === "Closed"))).toBe(0)
  })
})

describe("window comparisons", () => {
  it("compare the last N points with the N before", () => {
    const r = compareWindows([1, 2, 3, 4, 10, 20], 2)
    expect(r.current).toBe(30)
    expect(r.previous).toBe(7)
    expect(r.delta).toBe(23)
    expect(r.deltaPct).toBeCloseTo(328.6, 1)
    expect(compareWindows([5, 5], 2).previous).toBe(0)
    expect(compareWindows([5, 5], 2).deltaPct).toBeNull()
    expect(
      compareWindows(
        [90, 80, 100, 100],
        2,
        (v) => v.reduce((s, x) => s + x) / v.length
      )
    ).toEqual({ current: 100, previous: 85, delta: 15, deltaPct: 17.6 })
  })

  it("count and sum timestamped items per window", () => {
    const items = [
      { at: daysAgo(1), v: 10 },
      { at: daysAgo(3), v: 5 },
      { at: daysAgo(9), v: 1 },
      { at: daysAgo(40), v: 100 },
      { at: undefined, v: 7 },
    ]
    const count = countInWindows(items, (i) => i.at, 7)
    expect(count).toMatchObject({ current: 2, previous: 1, delta: 1 })
    const sum = sumInWindows(
      items,
      (i) => i.at,
      (i) => i.v,
      7
    )
    expect(sum).toMatchObject({ current: 15, previous: 1 })
  })

  it("count records open now versus N days ago", () => {
    const rows = [
      { opened: daysAgo(20), closed: daysAgo(2) },
      { opened: daysAgo(20), closed: undefined },
      { opened: daysAgo(1), closed: undefined },
    ]
    const r = openCountDelta(
      rows,
      (x) => x.opened,
      (x) => x.closed,
      14
    )
    expect(r.current).toBe(2)
    expect(r.previous).toBe(2)
    expect(r.delta).toBe(0)
  })

  it("derive the service-management deltas from the records", () => {
    for (const r of [
      openIncidentDelta(),
      slaComplianceDelta(),
      openAlertDelta(),
      fulfilledRequestSpendDelta(),
    ]) {
      expect(Number.isFinite(r.current)).toBe(true)
      expect(Number.isFinite(r.previous)).toBe(true)
      expect(Number.isFinite(r.delta)).toBe(true)
    }
    expect(openIncidentDelta().current).toBeGreaterThan(0)
    expect(meanTimeToResolveHours()).toBeGreaterThan(0)
    expect(NOW.getUTCDay()).toBe(4)
  })
})
