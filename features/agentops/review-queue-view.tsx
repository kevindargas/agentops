"use client"

import { useSearchParams } from "next/navigation"

import { getDeployedAgent } from "@/lib/data/agentops"
import { ReviewQueue } from "./review-queue"

/**
 * URL reader for the Review Queue page: `?item=<rev-id>` opens that item
 * first, `?agent=<agt-id>` scopes the queue. Must sit inside `<Suspense>`; the
 * queue is keyed on both so a new deep link resets the workspace.
 */
export function ReviewQueueView() {
  const params = useSearchParams()
  const item = params.get("item") ?? undefined
  const agentId = params.get("agent")
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return (
    <ReviewQueue
      key={`${item ?? ""}:${agent?.id ?? ""}`}
      initialSelectedId={item}
      agentId={agent?.id}
    />
  )
}
