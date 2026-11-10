"use client"

import type { RowData } from "@tanstack/react-table"
import { cn } from "cn"

import { Checkbox } from "@/components/ui/checkbox"
import { formatDate, formatDateTime, formatNumber, timeAgo } from "@/lib/format"
import type { DataTableFeatures, DataTableColumnMeta } from "./features"
import type { DisplayColumnDef } from "@tanstack/react-table"

/* ------------------------------------------------------------------------ */
/* Select column                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Standard leading checkbox column. Every table that supports bulk actions
 * should use this so the header / cell checkboxes stay aligned and identical.
 */
export function selectColumn<TData extends RowData>(): DisplayColumnDef<
  DataTableFeatures,
  TData,
  unknown
> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all rows on this page"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label={`Select row ${row.id}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      width: "w-9",
      headerClassName: "pr-0",
      cellClassName: "pr-0",
      skeleton: "size-4 rounded-[4px]",
    },
  }
}

/** Column meta preset for a trailing "…" actions column. */
export const actionsColumnMeta: DataTableColumnMeta = {
  width: "w-10",
  align: "right",
  label: "Actions",
  skeleton: "size-6 rounded-md",
}

/* ------------------------------------------------------------------------ */
/* Text                                                                      */
/* ------------------------------------------------------------------------ */

/** Single-line truncated text with the full value available on hover. */
export function TruncatedText({
  children,
  title,
  className,
  muted = false,
}: {
  children: React.ReactNode
  title?: string
  className?: string
  muted?: boolean
}) {
  const resolvedTitle =
    title ??
    (typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined)
  return (
    <span
      title={resolvedTitle}
      className={cn(
        "block min-w-0 truncate",
        muted && "text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}

/** Two-line cell: a primary label and a quieter secondary line underneath. */
export function TwoLineCell({
  primary,
  secondary,
  title,
  mono = false,
  className,
}: {
  primary: React.ReactNode
  secondary?: React.ReactNode
  title?: string
  /** Render the secondary line in monospace (serials, IPs, metrics). */
  mono?: boolean
  className?: string
}) {
  const resolvedTitle =
    title ?? (typeof primary === "string" ? primary : undefined)
  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      <p title={resolvedTitle} className="truncate font-medium text-foreground">
        {primary}
      </p>
      {secondary ? (
        <p
          className={cn(
            "mt-0.5 truncate text-xs text-muted-foreground",
            mono && "font-mono"
          )}
        >
          {secondary}
        </p>
      ) : null}
    </div>
  )
}

/** Placeholder for an empty value. */
export function EmptyValue({ className }: { className?: string }) {
  return (
    <span
      aria-label="Empty"
      className={cn("text-muted-foreground/60", className)}
    >
      —
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Numbers                                                                   */
/* ------------------------------------------------------------------------ */

/** Right-aligned number with tabular figures. Pair with `meta: { numeric: true }`. */
export function NumericCell({
  value,
  format,
  className,
  muted = false,
}: {
  value: number | null | undefined
  format?: (n: number) => string
  className?: string
  muted?: boolean
}) {
  if (value === null || value === undefined) return <EmptyValue />
  return (
    <span
      className={cn(
        "block text-right tabular-nums",
        muted && "text-muted-foreground",
        className
      )}
    >
      {format ? format(value) : formatNumber(value)}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Dates                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Humanised timestamp ("3 hours ago") with the absolute time in the title so
 * the exact moment is one hover away. Uses the demo clock from lib/format so
 * SSR and CSR agree.
 */
export function DateCell({
  value,
  mode = "relative",
  tone = "muted",
  className,
}: {
  value?: string | null
  /** `relative` → "2 days ago", `absolute` → "Nov 3, 2026", `datetime` → "Nov 3, 9:15 AM". */
  mode?: "relative" | "absolute" | "datetime"
  tone?: "muted" | "default" | "danger" | "warning"
  className?: string
}) {
  if (!value) return <EmptyValue />
  const label =
    mode === "relative"
      ? timeAgo(value)
      : mode === "absolute"
        ? formatDate(value)
        : formatDateTime(value)
  const title = mode === "relative" ? formatDateTime(value) : timeAgo(value)
  return (
    <time
      dateTime={value}
      title={title}
      className={cn(
        "whitespace-nowrap tabular-nums",
        tone === "muted" && "text-muted-foreground",
        tone === "danger" && "font-medium text-destructive",
        tone === "warning" && "font-medium text-warning-text",
        className
      )}
    >
      {label}
    </time>
  )
}
