import Link from "next/link"
import { cn } from "cn"
import { ChevronLeftIcon, PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { RecordCopyButton } from "./record-copy-button"
import {
  RecordOverflowMenu,
  type RecordOverflowItem,
} from "./record-overflow-menu"

/**
 * Header for every record form. Renders two siblings so the toolbar can stick
 * for the full page height (sticky is constrained by its parent's box):
 *   1. a sticky toolbar with number, badges, primary/secondary actions and overflow
 *   2. the title block with an inline-edit affordance and key meta chips
 */
export function RecordHeader({
  number,
  title,
  badges,
  meta,
  actions,
  overflow,
  backHref,
  backLabel,
  description,
  editable = true,
  sticky = true,
  className,
}: {
  number: string
  title: string
  badges?: React.ReactNode
  /** Key meta chips (assignee, group, opened, SLA…) — use `<MetaItem />`. */
  meta?: React.ReactNode
  /** Primary and secondary actions rendered in the toolbar. */
  actions?: React.ReactNode
  /** Items for the trailing overflow menu. */
  overflow?: RecordOverflowItem[]
  /** Link back to the list this record belongs to. */
  backHref?: string
  backLabel?: string
  /** Optional subtitle under the title. */
  description?: React.ReactNode
  /** Show the hover pencil affordance on the title (visual only). */
  editable?: boolean
  /** Pin the toolbar under the site header while scrolling. */
  sticky?: boolean
  className?: string
}) {
  const hasActions = Boolean(actions) || (overflow?.length ?? 0) > 0
  return (
    <>
      <div
        data-slot="record-toolbar"
        className={cn(
          "z-20 -mx-4 -mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 lg:-mx-6 lg:-mt-6 lg:px-6",
          sticky && "sticky top-(--header-height)"
        )}
      >
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-1.5 sm:basis-0">
          {backHref && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="-ml-1.5 text-muted-foreground"
              render={
                <Link
                  href={backHref}
                  aria-label={backLabel ? `Back to ${backLabel}` : "Back"}
                  title={backLabel ? `Back to ${backLabel}` : "Back"}
                />
              }
            >
              <ChevronLeftIcon />
            </Button>
          )}
          <span className="inline-flex items-center gap-0.5">
            <span className="font-mono text-xs font-medium tracking-tight text-foreground">
              {number}
            </span>
            <RecordCopyButton value={number} />
          </span>
          {badges && (
            <>
              <Separator
                orientation="vertical"
                className="hidden h-4 sm:block"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {badges}
              </div>
            </>
          )}
        </div>
        {hasActions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
            {overflow && overflow.length > 0 && (
              <RecordOverflowMenu items={overflow} number={number} />
            )}
          </div>
        )}
      </div>

      <div
        data-slot="record-title"
        className={cn("-mt-2 flex flex-col gap-3", className)}
      >
        <div className="group/title flex min-w-0 items-start gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-balance md:text-2xl">
            {title}
          </h1>
          {editable && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Edit title"
              title="Edit title"
              className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100"
            >
              <PencilIcon />
            </Button>
          )}
        </div>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {meta && (
          <div className="flex flex-wrap items-center gap-1.5">{meta}</div>
        )}
      </div>
    </>
  )
}

export type MetaTone = "default" | "info" | "success" | "warning" | "danger"

const metaTone: Record<MetaTone, string> = {
  default: "border-border bg-card",
  info: "border-info/30 bg-info/10",
  success: "border-success/30 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
}

/** A compact label/value chip for the header meta row. */
export function MetaItem({
  label,
  icon,
  href,
  tone = "default",
  className,
  children,
}: {
  label: string
  icon?: React.ReactNode
  href?: string
  tone?: MetaTone
  className?: string
  children: React.ReactNode
}) {
  const classes = cn(
    "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs leading-none",
    "[&_[data-slot=avatar]]:size-4 [&_[data-slot=avatar]]:text-[8px] [&_span.text-sm]:text-xs",
    metaTone[tone],
    href && "transition-colors hover:bg-muted",
    className
  )
  const inner = (
    <>
      {icon && (
        <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">
          {icon}
        </span>
      )}
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate font-medium",
          tone === "danger" ? "text-destructive" : "text-foreground"
        )}
      >
        {children}
      </span>
    </>
  )
  return href ? (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  ) : (
    <span className={classes}>{inner}</span>
  )
}

export { Button as RecordAction }
export type { RecordOverflowItem }
