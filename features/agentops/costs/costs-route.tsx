"use client"

import { useSearchParams } from "next/navigation"

import { CostsView } from "./costs-view"
import { isCostsTab } from "./tabs"

/**
 * Client entry for /agentops/costs. Reads `?tab=`, `?agent=` and `?budget=`
 * through `useSearchParams` (the page wraps it in `<Suspense>` with the table
 * skeleton) so the server page stays static.
 */
export function CostsRoute() {
  const params = useSearchParams()
  const tab = params.get("tab") ?? undefined

  return (
    <CostsView
      tab={isCostsTab(tab) ? tab : "budgets"}
      agentId={params.get("agent") ?? undefined}
      budgetId={params.get("budget") ?? undefined}
    />
  )
}
