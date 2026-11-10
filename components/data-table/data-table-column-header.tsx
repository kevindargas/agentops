"use client"

import type { Column, RowData } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DataTableFeatures } from "./features"

/**
 * Column header with a sort affordance that only appears on hover (or while
 * the column is actively sorted). Click cycles asc → desc → none; the menu
 * exposes explicit sort directions and hide-column.
 */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
  align,
}: {
  column: Column<DataTableFeatures, TData, TValue>
  title: string
  className?: string
  align?: "left" | "center" | "right"
}) {
  const resolvedAlign =
    align ??
    column.columnDef.meta?.align ??
    (column.columnDef.meta?.numeric ? "right" : "left")
  const justify =
    resolvedAlign === "right"
      ? "justify-end"
      : resolvedAlign === "center"
        ? "justify-center"
        : "justify-start"

  if (!column.getCanSort()) {
    return (
      <div
        className={cn(
          "flex items-center text-xs font-medium text-muted-foreground",
          justify,
          className
        )}
      >
        <span className="whitespace-nowrap">{title}</span>
      </div>
    )
  }

  const sorted = column.getIsSorted()
  const SortIcon =
    sorted === "desc"
      ? ArrowDownIcon
      : sorted === "asc"
        ? ArrowUpIcon
        : ChevronsUpDownIcon

  return (
    <div className={cn("flex items-center", justify, className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "group/sort -mx-1.5 inline-flex h-7 max-w-full items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap transition-colors outline-none select-none",
                "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground",
                sorted && "text-foreground",
                resolvedAlign === "right" && "flex-row-reverse"
              )}
              aria-label={`${title}: ${sorted === "asc" ? "sorted ascending" : sorted === "desc" ? "sorted descending" : "not sorted"}. Open sort menu.`}
            />
          }
        >
          <span className="whitespace-nowrap">{title}</span>
          <SortIcon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 transition-opacity",
              sorted
                ? "opacity-100"
                : "opacity-0 group-hover/sort:opacity-60 group-data-popup-open/sort:opacity-60"
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={resolvedAlign === "right" ? "end" : "start"}
          className="w-40"
        >
          <DropdownMenuItem
            onClick={() => column.toggleSorting(false)}
            className={cn(sorted === "asc" && "bg-muted")}
          >
            <ArrowUpIcon />
            Sort ascending
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => column.toggleSorting(true)}
            className={cn(sorted === "desc" && "bg-muted")}
          >
            <ArrowDownIcon />
            Sort descending
          </DropdownMenuItem>
          {sorted && (
            <DropdownMenuItem onClick={() => column.clearSorting()}>
              <XIcon />
              Clear sort
            </DropdownMenuItem>
          )}
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOffIcon />
                Hide column
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
