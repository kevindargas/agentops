"use client"

import { useSearchParams } from "next/navigation"

import { getDeployedAgent } from "@/lib/data/agentops"
import { DriftBoard } from "./drift-board"

/**
 * URL reader for the Drift & Quality page: `?agent=<agt-id>` scopes the board,
 * `?state=Open|Acknowledged|Resolved|active|all` preselects the filter. Must
 * sit inside `<Suspense>`; the board is keyed on both so a new deep link
 * resets it.
 */
export function DriftView() {
  const params = useSearchParams()
  const agentId = params.get("agent")
  const state = params.get("state") ?? undefined
  const agent = agentId ? getDeployedAgent(agentId) : undefined
  return (
    <DriftBoard
      key={`${agent?.id ?? ""}:${state ?? ""}`}
      initialAgentId={agent?.id}
      initialState={state}
    />
  )
}
