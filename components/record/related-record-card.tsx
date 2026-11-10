import Link from "next/link"
import { cn } from "cn"
import { ArrowUpRightIcon, LinkIcon } from "lucide-react"

import { StateBadge } from "@/components/shared/status-badge"

/** Compact linked-record tile for a record sidebar (parent problem, related change, CI…). */
export function RelatedRecordCard({
  number,
  type,
  title,
  href,
  state,
  icon,
  meta,
  className,
}: {
  number: string
  type: string
  title: string
  /** Omit to render a static (non-link) tile. */
  href?: string
  state?: string
  icon?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}) {
  const body = (
    <>
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon ?? <LinkIcon />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium tracking-tight text-foreground">
            {number}
          </span>
          <span>{type}</span>
          {state && (
            <StateBadge
              state={state}
              className="ml-auto h-4 px-1.5 text-[10px]"
              dot={false}
            />
          )}
        </span>
        <span className="line-clamp-2 leading-snug">{title}</span>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </span>
      {href && (
        <ArrowUpRightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/related:opacity-100" />
      )}
    </>
  )
  const base =
    "group/related flex items-start gap-2.5 rounded-lg border bg-card p-2.5 text-sm"
  if (!href) return <div className={cn(base, className)}>{body}</div>
  return (
    <Link
      href={href}
      className={cn(
        base,
        "transition-colors hover:border-foreground/20 hover:bg-muted/50",
        className
      )}
    >
      {body}
    </Link>
  )
}

/** Dashed placeholder shown when a relationship slot is empty. */
export function RelatedRecordEmpty({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}
