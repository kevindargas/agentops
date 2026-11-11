"use client"

import { useSearchParams } from "next/navigation"

import { useQueryParam } from "@/hooks/use-query-param"
import { ExperimentsTable } from "./experiments"

/**
 * URL reader for the Experiments list page. `?open=<exp-id>` is the open
 * sheet: opening a row writes it and closing clears it (history.replaceState,
 * no navigation), so the URL is always shareable. `?agent=<agt-id>` preselects
 * the Agent facet; the table is keyed on it so a new deep link resets the
 * table state. Must sit inside `<Suspense>`.
 */
export function ExperimentsView() {
  const params = useSearchParams()
  const agent = params.get("agent") ?? undefined
  const [open, setOpen] = useQueryParam("open")
  return (
    <ExperimentsTable
      key={agent ?? ""}
      initialAgentFacet={agent}
      openId={open}
      onOpenChange={setOpen}
    />
  )
}
