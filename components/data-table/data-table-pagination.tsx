"use client"

import type { PaginationState, RowData, Table } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DataTableFeatures } from "./features"

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100]

function PageButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              className
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function DataTablePagination<TData extends RowData>({
  table,
  pagination,
  totalLabel,
  pageSizeOptions,
  className,
}: {
  table: Table<DataTableFeatures, TData>
  pagination: PaginationState
  totalLabel?: string
  pageSizeOptions?: number[]
  className?: string
}) {
  const { pageIndex, pageSize } = pagination
  const total = table.getRowCount()
  const pageCount = Math.max(1, table.getPageCount())
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(total, (pageIndex + 1) * pageSize)
  const selected = table.getSelectedRowModel().rows.length
  const sizes = Array.from(
    new Set([...(pageSizeOptions ?? DEFAULT_PAGE_SIZES), pageSize])
  ).sort((a, b) => a - b)
  const sizeItems = sizes.map((n) => ({ value: String(n), label: String(n) }))
  const label = totalLabel ?? "records"

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-1 text-sm sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p
        className="text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {selected > 0 ? (
          <>
            <span className="font-medium text-foreground">{selected}</span> of{" "}
            {total} selected
          </>
        ) : total === 0 ? (
          <>No {label}</>
        ) : (
          <>
            <span className="font-medium text-foreground">
              {from} to {to}
            </span>{" "}
            of {total} {label}
          </>
        )}
      </p>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <Select
            items={sizeItems}
            value={String(pageSize)}
            onValueChange={(v) => v && table.setPageSize(Number(v))}
          >
            <SelectTrigger
              size="sm"
              className="w-17 text-xs tabular-nums"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top" alignItemWithTrigger={false}>
              {sizeItems.map((item) => (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  className="tabular-nums"
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          Page {pageIndex + 1} of {pageCount}
        </span>

        <div className="flex items-center gap-0.5">
          <PageButton
            label="First page"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
            className="hidden sm:inline-flex"
          >
            <ChevronsLeftIcon />
          </PageButton>
          <PageButton
            label="Previous page"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon />
          </PageButton>
          <PageButton
            label="Next page"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon />
          </PageButton>
          <PageButton
            label="Last page"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
            className="hidden sm:inline-flex"
          >
            <ChevronsRightIcon />
          </PageButton>
        </div>
      </div>
    </div>
  )
}
