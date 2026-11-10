"use client"

import type { Column, RowData, Table } from "@tanstack/react-table"
import { Settings2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DataTableFeatures } from "./features"

/** Human-readable label for a column: explicit meta label → string header → camelCase id. */
export function columnLabel<TData extends RowData>(
  column: Column<DataTableFeatures, TData, unknown>
) {
  const meta = column.columnDef.meta
  if (meta?.label) return meta.label
  const header = column.columnDef.header
  if (typeof header === "string") return header
  return column.id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  onReset,
}: {
  table: Table<DataTableFeatures, TData>
  /** Restore the table's initial column visibility. */
  onReset?: () => void
}) {
  const columns = table
    .getAllColumns()
    .filter((c) => c.getCanHide() && c.id !== "select" && c.id !== "actions")
  const hiddenCount = columns.filter((c) => !c.getIsVisible()).length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex"
            aria-label="Toggle columns"
          />
        }
      >
        <Settings2Icon />
        View
        {hiddenCount > 0 && (
          <span className="rounded-sm bg-muted px-1 font-mono text-3xs text-muted-foreground tabular-nums">
            {hiddenCount} hidden
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Toggle columns
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
              closeOnClick={false}
            >
              {columnLabel(column)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => columns.forEach((c) => c.toggleVisibility(true))}
          disabled={hiddenCount === 0}
        >
          Show all
        </DropdownMenuItem>
        {onReset && (
          <DropdownMenuItem onClick={onReset}>
            Reset to default
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
