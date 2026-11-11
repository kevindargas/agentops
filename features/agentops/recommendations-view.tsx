"use client"

import { useSearchParams } from "next/navigation"

import { getDeployedAgent } from "@/lib/data/agentops"
import { RecommendationsList } from "./recommendations-list"

/**
 * URL reader for the Recommendations page: `?open=<rec-id>` (or the older
 * `?rec=`) scrolls to and outlines one card, `?agent=<agt-id>` scopes the
 * list. Must sit inside `<Suspense>`; the list is keyed on both so a new deep
 * link resets the filter and scroll position.
 */
export function RecommendationsView() {
  const params = useSearchParams()
  const open = params.get("open") ?? params.get("rec") ?? undefined
  const agentId = params.get("agent")
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return (
    <RecommendationsList
      key={`${open ?? ""}:${agent?.id ?? ""}`}
      agentId={agent?.id}
      highlightId={open}
    />
  )
}
