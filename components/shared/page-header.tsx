import { cn } from "cn"

import { CountPill } from "@/components/shared/count-pill"
import { Eyebrow } from "@/components/shared/eyebrow"
import { findNavGroup, findNavItem } from "@/config/nav"

export interface PageHeaderProps {
  /** Defaults to the nav item's title when `nav` is given. */
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  /** Rendered below the header row: tabs, filters, summary strips. */
  children?: React.ReactNode
  /**
   * Small uppercase label above the title. Pass the sidebar group label
   * ("Agent Operations", "Govern") or let `nav` resolve it.
   */
  eyebrow?: React.ReactNode
  /**
   * Nav href of this page (e.g. "/agentops/traces"). Resolves `eyebrow` to the
   * owning sidebar group, `icon` to the nav icon and `title` to the nav title
   * unless those props are set, so the header, sidebar and breadcrumb agree.
   */
  nav?: string
  /** Breadcrumb or back-link slot rendered above the eyebrow/title. */
  breadcrumb?: React.ReactNode
  /** Leading icon shown in a tile next to the title. */
  icon?: React.ReactNode
  /** Inline badges/chips rendered after the title (status, record number). */
  meta?: React.ReactNode
  /** Draw a hairline under the header. Defaults to true. */
  divider?: boolean
  /** Visual size of the title. `lg` for dashboards and landing pages. */
  size?: "default" | "lg"
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
  eyebrow,
  nav,
  breadcrumb,
  icon,
  meta,
  divider = true,
  size = "default",
}: PageHeaderProps) {
  const navItem = nav ? findNavItem(nav) : undefined
  const navGroup = nav ? findNavGroup(nav) : undefined
  const resolvedTitle = title ?? navItem?.title
  const resolvedEyebrow = eyebrow ?? navGroup?.label
  const NavIcon = navItem?.icon
  const resolvedIcon = icon ?? (NavIcon ? <NavIcon /> : undefined)

  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4",
        divider && "border-b border-border/70 pb-5",
        className
      )}
    >
      {breadcrumb && (
        <div className="text-xs text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-foreground">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {resolvedIcon && (
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/60 ring-inset [&_svg]:size-4.5">
              {resolvedIcon}
            </span>
          )}
          <div className="min-w-0 space-y-1">
            {resolvedEyebrow && <Eyebrow>{resolvedEyebrow}</Eyebrow>}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1
                className={cn(
                  "font-heading font-semibold tracking-tight text-foreground",
                  size === "lg" ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"
                )}
              >
                {resolvedTitle}
              </h1>
              {meta && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {meta}
                </div>
              )}
            </div>
            {description && (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:pl-4">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export interface SectionProps {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
  /** Small uppercase label above the title. */
  eyebrow?: React.ReactNode
  /** Count shown in a pill next to the title. */
  count?: number
  /** Leading icon next to the title. */
  icon?: React.ReactNode
  /** Anchor id for in-page navigation. */
  id?: string
}

export function Section({
  title,
  description,
  actions,
  className,
  children,
  eyebrow,
  count,
  icon,
  id,
}: SectionProps) {
  return (
    <section
      id={id}
      data-slot="section"
      className={cn("flex scroll-mt-20 flex-col gap-3", className)}
    >
      {(title || actions || eyebrow) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                {icon && (
                  <span className="inline-flex text-muted-foreground [&_svg]:size-4">
                    {icon}
                  </span>
                )}
                <span className="truncate">{title}</span>
                {count !== undefined && (
                  <CountPill count={count} size="default" />
                )}
              </h2>
            )}
            {description && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
