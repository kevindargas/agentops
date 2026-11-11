"use client"

import { useSearchParams } from "next/navigation"

import { PromptsTable } from "./prompts-table"

/**
 * URL reader for the Prompts list page: `?agent=<agt-id>` preselects the
 * Agent facet. Must sit inside `<Suspense>`; the table is keyed on the agent
 * so a new deep link resets the facet selection.
 */
export function PromptsView() {
  const params = useSearchParams()
  const agent = params.get("agent") ?? undefined
  return <PromptsTable key={agent ?? ""} agentId={agent} />
}
