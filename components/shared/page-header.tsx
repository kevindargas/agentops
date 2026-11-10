import { cn } from "cn"

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  /** Rendered below the header row: tabs, filters, summary strips. */
  children?: React.ReactNode
  /** Small uppercase label above the title, e.g. the module name ("ITSM · Incidents"). */
  eyebrow?: React.ReactNode
  /** Breadcrumb or back-link slot rendered above the eyebrow/title. */
  breadcrumb?: React.ReactNode
  /** Leading icon shown in a tile next to the title. */
  icon?: React.ReactNode
  /** Inline badges/chips rendered after the title (status, record number…). */
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
  breadcrumb,
  icon,
  meta,
  divider = true,
  size = "default",
}: PageHeaderProps) {
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
          {icon && (
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/60 ring-inset [&_svg]:size-4.5">
              {icon}
            </span>
          )}
          <div className="min-w-0 space-y-1">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1
                className={cn(
                  "font-heading font-semibold tracking-tight text-foreground",
                  size === "lg" ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"
                )}
              >
                {title}
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                {icon && (
                  <span className="inline-flex text-muted-foreground [&_svg]:size-4">
                    {icon}
                  </span>
                )}
                <span className="truncate">{title}</span>
                {count !== undefined && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium num text-muted-foreground">
                    {count}
                  </span>
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
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
