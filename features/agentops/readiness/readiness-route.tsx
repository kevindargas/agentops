"use client"

import { useSearchParams } from "next/navigation"

import { ReadinessView } from "./readiness-view"

/**
 * Client entry for /agentops/readiness. Reads `?tab=` and `?control=` through
 * `useSearchParams` (the page wraps it in `<Suspense>` with the table
 * skeleton) so the server page stays static.
 */
export function ReadinessRoute() {
  const params = useSearchParams()
  return (
    <ReadinessView
      initialTab={params.get("tab") ?? undefined}
      initialControlId={params.get("control") ?? undefined}
    />
  )
}
