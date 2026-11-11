"use client"

import { useSearchParams } from "next/navigation"

import { auditSources, type AuditSource } from "@/lib/data/audit"
import { AuditView } from "./audit-view"

/**
 * Client entry for /agentops/audit. Reads `?source=` and `?q=` through
 * `useSearchParams` (the page wraps it in `<Suspense>` with the table
 * skeleton) and seeds the table's facet and search box with them. `AuditView`
 * reads `?event=` and `?range=` itself and never writes `source` or `q`, so
 * the key below only changes when a link into this route changes them.
 */
export function AuditRoute() {
  const params = useSearchParams()
  const source = params.get("source")
  const q = params.get("q")
  const initialSource = auditSources.includes(source as AuditSource)
    ? (source as AuditSource)
    : undefined
  const initialQuery = q?.trim() ? q.trim().slice(0, 80) : undefined

  return (
    <AuditView
      key={`${initialSource ?? ""}:${initialQuery ?? ""}`}
      initialSource={initialSource}
      initialQuery={initialQuery}
    />
  )
}
