import Link from "next/link"
import { cn } from "cn"

export interface RecordLinkProps {
  number: string
  href?: string
  className?: string
  /** Resolve `href` from the id prefix via `recordHref` when none is given. */
  auto?: boolean
  /** `sm` matches body text; `xs` (default) fits table cells. */
  size?: "xs" | "sm"
  /** De-emphasise (secondary references, parent records). */
  muted?: boolean
}

/** Monospace record number that links to its detail page. */
export function RecordLink({
  number,
  href,
  className,
  auto = false,
  size = "xs",
  muted = false,
}: RecordLinkProps) {
  const target = href ?? (auto ? recordHref(number) : undefined)
  const classes = cn(
    "font-mono font-medium num tracking-tight whitespace-nowrap",
    size === "xs" ? "text-xs" : "text-sm",
    muted ? "text-muted-foreground" : "text-foreground",
    className
  )
  if (!target || target === "#")
    return <span className={classes}>{number}</span>
  return (
    <Link
      href={target}
      className={cn(
        classes,
        "rounded-xs underline decoration-transparent decoration-1 underline-offset-[3px] transition-colors hover:text-foreground hover:decoration-muted-foreground/60 focus-visible:decoration-ring"
      )}
    >
      {number}
    </Link>
  )
}

/**
 * Detail route for a record id, by prefix. Service-management numbers
 * (INC, PRB, CHG, REQ, KB) and Agent Operations ids (agt-, tr_, prm-, ev-,
 * rel-) resolve to record pages; sheet-driven ids (grd-, sem-, exp-) resolve
 * to their list page with the opening query param. Unknown ids return "#".
 */
export function recordHref(number: string) {
  if (number.startsWith("INC")) return `/itsm/incidents/${number}`
  if (number.startsWith("PRB")) return `/itsm/problems/${number}`
  if (number.startsWith("CHG")) return `/itsm/changes/${number}`
  if (number.startsWith("REQ")) return `/itsm/requests/${number}`
  if (number.startsWith("KB")) return `/itsm/knowledge/${number}`
  if (number.startsWith("agt-")) return `/agentops/agents/${number}`
  if (number.startsWith("tr_")) return `/agentops/traces/${number}`
  if (number.startsWith("prm-")) return `/agentops/prompts/${number}`
  if (number.startsWith("ev-")) return `/agentops/evals/${number}`
  if (number.startsWith("rel-")) return `/agentops/deployments/${number}`
  if (number.startsWith("grd-")) return `/agentops/guardrails?policy=${number}`
  if (number.startsWith("sem-"))
    return `/agentops/semantic-layer?entity=${number}`
  if (number.startsWith("exp-")) return `/agentops/experiments?open=${number}`
  if (number.startsWith("aud-")) return `/agentops/audit?event=${number}`
  return "#"
}
