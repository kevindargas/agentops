import Link from "next/link"
import { cn } from "cn"
import { ArrowRightIcon, InboxIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface RelatedColumn<T> {
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
  /** Hide below the `sm` breakpoint to keep narrow layouts readable. */
  hideOnMobile?: boolean
}

/** Compact embedded list for related records on a form (tasks, incidents, CIs…). */
export function RelatedList<T>({
  title,
  description,
  rows,
  columns,
  getKey,
  getHref,
  emptyMessage = "No related records.",
  emptyIcon,
  action,
  viewAllHref,
  maxRows,
  className,
}: {
  title: string
  description?: string
  rows: T[]
  columns: RelatedColumn<T>[]
  getKey: (row: T) => string
  getHref?: (row: T) => string
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  /** "Add" affordance in the header; also surfaced in the empty state. */
  action?: {
    label: string
    href?: string
    onClick?: () => void
    icon?: React.ReactNode
  }
  /** Link to the full list when `maxRows` truncates. */
  viewAllHref?: string
  maxRows?: number
  className?: string
}) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows
  const hidden = rows.length - visible.length
  const actionButton = action && (
    <Button
      variant="outline"
      size="sm"
      render={action.href ? <Link href={action.href} /> : undefined}
      onClick={action.onClick}
    >
      {action.icon ?? <PlusIcon />} {action.label}
    </Button>
  )

  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {title}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
              {rows.length}
            </span>
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actionButton}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
            {emptyIcon ?? <InboxIcon />}
          </span>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          {action && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              render={action.href ? <Link href={action.href} /> : undefined}
              onClick={action.onClick}
            >
              {action.icon ?? <PlusIcon />} {action.label}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead
                    key={c.header}
                    className={cn(
                      "h-8 text-xs font-medium text-muted-foreground",
                      c.hideOnMobile && "hidden sm:table-cell",
                      c.className
                    )}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={getKey(row)} className="group/row text-sm">
                  {columns.map((c, i) => (
                    <TableCell
                      key={c.header}
                      className={cn(
                        "h-10 py-1.5",
                        c.hideOnMobile && "hidden sm:table-cell",
                        c.className
                      )}
                    >
                      {i === 0 && getHref ? (
                        <Link
                          href={getHref(row)}
                          className="inline-flex items-center gap-1 underline-offset-4 group-hover/row:underline"
                        >
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(hidden > 0 || viewAllHref) && (
            <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                {hidden > 0
                  ? `${hidden} more not shown`
                  : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
              </span>
              {viewAllHref && (
                <Link
                  href={viewAllHref}
                  className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  View all <ArrowRightIcon className="size-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
