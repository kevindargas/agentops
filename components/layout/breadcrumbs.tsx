"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { HomeIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { flatNavigation } from "@/config/nav"

/**
 * Labels for route segments that are modules rather than pages. These win over
 * nav titles for intermediate crumbs, so `/agentops/agents/agt-x` reads
 * "Agent Operations / Agents / agt-x" instead of "Fleet Overview / ...".
 */
const segmentLabels: Record<string, string> = {
  itsm: "Service Management",
  itom: "Service Health",
  admin: "Administration",
  agentops: "Agent Operations",
}

const RECORD_NUMBER = /^[A-Z]{2,6}\d{5,}$/

/**
 * Routed id prefixes (see "Feature layout and ids" in conventions.md). Add a
 * prefix here when a new record route appears so the crumb renders in mono
 * instead of being title-cased.
 */
export const RECORD_PREFIXES = [
  "agt-",
  "tr_",
  "exp-",
  "sem-",
  "prm-",
  "ev-",
  "rel-",
  "sch-",
  "trg-",
  "aud-",
  "grd-",
  "kb-",
  "drf-",
  "bud-",
  "key-",
  "rec-",
  "vio-",
  "ds-",
] as const

/** Record identifiers (INC0010042, agt-..., prm-...) are shown verbatim in mono. */
export function isRecordSegment(segment: string) {
  return (
    RECORD_NUMBER.test(segment) ||
    RECORD_PREFIXES.some((prefix) => segment.startsWith(prefix))
  )
}

function navTitle(path: string) {
  return flatNavigation.find((n) => n.href.split("?")[0] === path)?.title
}

function labelFor(path: string, segment: string, last: boolean) {
  if (isRecordSegment(segment)) return segment
  // Intermediate module segments read as the module, not the landing page.
  if (!last && segmentLabels[segment]) return segmentLabels[segment]
  return (
    navTitle(path) ??
    segmentLabels[segment] ??
    segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = segments
    .map((seg, i) => {
      const path = "/" + segments.slice(0, i + 1).join("/")
      const last = i === segments.length - 1
      return {
        label: labelFor(path, seg, last),
        path,
        hasPage: navTitle(path) !== undefined || last,
        record: isRecordSegment(seg),
      }
    })
    // A group and its only page can share a name ("Service Health"); keep the page.
    .filter(
      (c, i, all) => !(i < all.length - 1 && all[i + 1].label === c.label)
    )
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap gap-0.5 text-[13px] sm:gap-1">
        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbLink
            render={<Link href="/dashboard" />}
            aria-label="Home"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HomeIcon className="size-3.5" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <React.Fragment key={c.path}>
              <BreadcrumbSeparator className="hidden text-muted-foreground/50 md:block [&>svg]:size-3" />
              <BreadcrumbItem
                className={last ? "min-w-0" : "hidden md:inline-flex"}
              >
                {last ? (
                  <BreadcrumbPage
                    className={cn(
                      "max-w-48 truncate font-medium xl:max-w-72",
                      c.record && "font-mono text-xs tracking-tight"
                    )}
                  >
                    {c.label}
                  </BreadcrumbPage>
                ) : c.hasPage ? (
                  <BreadcrumbLink
                    render={<Link href={c.path} />}
                    className="max-w-40 truncate rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {c.label}
                  </BreadcrumbLink>
                ) : (
                  <span className="max-w-40 truncate px-1.5 text-muted-foreground/80">
                    {c.label}
                  </span>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
