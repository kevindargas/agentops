import { proposals } from "@/lib/ai/agents"
import { approvals } from "@/lib/data/activity"
import { modelRecommendations, reviewItems } from "@/lib/data/agentops"
import { alerts } from "@/lib/data/itom"
import type { NavCounts } from "./nav"

/**
 * Live counts behind the sidebar badges, derived from the same selectors the
 * target pages use so the badge and the page header always agree:
 *
 * - approvals: every item in the approvals inbox (`/approvals` "Pending")
 * - reviews: review items with status Pending (`/agentops/reviews` "Pending")
 * - recommendations: recommendations with status New
 * - alerts: alerts that are not Closed (`/itom/alerts` "Open alerts")
 * - proposals: workflow-agent proposals awaiting approval (`/ai`)
 *
 * This module imports data modules directly and is meant to run on the server
 * (`app/(app)/layout.tsx`); pass the result down as a prop so the fixtures stay
 * out of the client bundle.
 */
export function getNavCounts(): NavCounts {
  return {
    approvals: approvals.length,
    reviews: reviewItems.filter((r) => r.status === "Pending").length,
    recommendations: modelRecommendations.filter((r) => r.status === "New")
      .length,
    alerts: alerts.filter((a) => a.state !== "Closed").length,
    proposals: proposals.length,
  }
}
