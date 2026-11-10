"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  FlexRender,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { cn } from "cn"
import { FilterXIcon, InboxIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DataTableFacetedFilter,
  type FacetOption,
} from "./data-table-faceted-filter"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableViewOptions } from "./data-table-view-options"
import { dataTableFeatures, type DataTableFeatures } from "./features"

export interface FacetDef<TData extends RowData> {
  id: string
  title: string
  options: FacetOption[]
  /** Facet value(s) for a row. Return an array for multi-valued attributes (tags, capabilities). */
  getValue: (row: TData) => string | string[]
}

const facetValues = (v: string | string[]) => (Array.isArray(v) ? v : [v])

export type DataTableDensity = "comfortable" | "compact"

export interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData, unknown>[]
  data: TData[]
  getRowId: (row: TData) => string
  /** Text used by the search box. Return the concatenated searchable text. */
  getSearchText?: (row: TData) => string
  searchPlaceholder?: string
  facets?: FacetDef<TData>[]
  initialFacets?: Record<string, string[]>
  initialSorting?: SortingState
  initialColumnVisibility?: ColumnVisibilityState
  pageSize?: number
  /** Options offered in the "Rows per page" select. */
  pageSizeOptions?: number[]
  rowHref?: (row: TData) => string
  onRowClick?: (row: TData) => void
  /** Extra controls rendered at the trailing edge of the toolbar (before View). */
  toolbar?: React.ReactNode
  /** Rendered inside the floating selection bar when at least one row is selected. */
  bulkActions?: (
    rows: Row<DataTableFeatures, TData>[],
    clear: () => void
  ) => React.ReactNode
  /** Title shown in the empty state. Defaults depend on whether filters are active. */
  emptyTitle?: string
  /** Description shown in the empty state. */
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  /** Action rendered in the empty state when no filters are active (e.g. a "New record" button). */
  emptyAction?: React.ReactNode
  /** Noun used in the pagination footer, e.g. "incidents". */
  totalLabel?: string
  className?: string
  /** Row density. `compact` tightens vertical padding. */
  density?: DataTableDensity
  /** @deprecated Use `density="compact"`. Kept for backward compatibility. */
  dense?: boolean
  /** Render skeleton rows instead of data. */
  loading?: boolean
  /** Number of skeleton rows while loading. Defaults to the page size (max 10). */
  loadingRows?: number
  /** Constrain the table body height and make the header sticky, e.g. `max-h-[70vh]`. */
  maxHeight?: string
  /** Hide the toolbar entirely (search, filters, view). */
  hideToolbar?: boolean
  /** Hide the pagination footer. */
  hidePagination?: boolean
  /** Text rendered when the selection bar shows; defaults to "{n} selected". */
  selectionLabel?: (count: number) => string
}

function alignClass(align?: "left" | "center" | "right") {
  return align === "right"
    ? "text-right"
    : align === "center"
      ? "text-center"
      : undefined
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  getSearchText,
  searchPlaceholder = "Search…",
  facets = [],
  initialFacets,
  initialSorting = [],
  initialColumnVisibility = {},
  pageSize = 20,
  pageSizeOptions,
  rowHref,
  onRowClick,
  toolbar,
  bulkActions,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  emptyAction,
  totalLabel,
  className,
  density,
  dense = false,
  loading = false,
  loadingRows,
  maxHeight,
  hideToolbar = false,
  hidePagination = false,
  selectionLabel,
}: DataTableProps<TData>) {
  const router = useRouter()
  const compact = density === "compact" || (density === undefined && dense)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const [search, setSearch] = React.useState("")
  const [facetState, setFacetState] = React.useState<
    Record<string, Set<string>>
  >(() => {
    const init: Record<string, Set<string>> = {}
    for (const f of facets) init[f.id] = new Set(initialFacets?.[f.id] ?? [])
    return init
  })
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>(initialColumnVisibility)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  const facetCounts = React.useMemo(() => {
    const counts = new Map<string, Map<string, number>>()
    for (const f of facets) {
      const m = new Map<string, number>()
      for (const row of data) {
        for (const v of facetValues(f.getValue(row)))
          m.set(v, (m.get(v) ?? 0) + 1)
      }
      counts.set(f.id, m)
    }
    return counts
  }, [data, facets])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((row) => {
      for (const f of facets) {
        const sel = facetState[f.id]
        if (
          sel &&
          sel.size > 0 &&
          !facetValues(f.getValue(row)).some((v) => sel.has(v))
        )
          return false
      }
      if (q && getSearchText && !getSearchText(row).toLowerCase().includes(q))
        return false
      return true
    })
  }, [data, facets, facetState, search, getSearchText])

  const table = useTable({
    features: dataTableFeatures,
    data: filtered,
    columns,
    getRowId,
    enableRowSelection: true,
    state: { sorting, columnVisibility, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  })

  // Any filter change returns the user to the first page.
  const resetPage = () =>
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  const updateSearch = (value: string) => {
    setSearch(value)
    resetPage()
  }
  const updateFacet = (id: string, next: Set<string>) => {
    setFacetState((s) => ({ ...s, [id]: next }))
    resetPage()
  }
  const resetFilters = () => {
    setSearch("")
    setFacetState((s) =>
      Object.fromEntries(Object.keys(s).map((k) => [k, new Set<string>()]))
    )
    resetPage()
  }
  const clearSelection = () => setRowSelection({})

  const isFiltered =
    search.length > 0 || Object.values(facetState).some((s) => s.size > 0)
  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const visibleColumns = table.getVisibleLeafColumns()
  const rows = table.getRowModel().rows
  const interactive = Boolean(rowHref || onRowClick)
  const skeletonCount = Math.min(loadingRows ?? pagination.pageSize, 10)

  // Keyboard: Escape clears the selection, "/" focuses search.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedCount > 0) {
        setRowSelection({})
        return
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        )
          return
        if (searchRef.current) {
          e.preventDefault()
          searchRef.current.focus()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedCount])

  const openRow = (row: TData, e: React.MouseEvent) => {
    if (onRowClick) {
      onRowClick(row)
      return
    }
    if (!rowHref) return
    const href = rowHref(row)
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener")
    else router.push(href)
  }

  const headPad = compact ? "h-8" : "h-9"
  const cellPad = compact ? "py-1 h-9" : "py-2 h-11"

  return (
    <div className={cn("relative flex flex-col gap-3", className)}>
      {!hideToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {getSearchText && (
            <InputGroup className="h-8 w-full sm:w-64">
              <InputGroupAddon>
                <SearchIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchRef}
                value={search}
                onChange={(e) => updateSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="text-sm"
              />
              <InputGroupAddon align="inline-end">
                {search ? (
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => updateSearch("")}
                    aria-label="Clear search"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XIcon />
                  </InputGroupButton>
                ) : (
                  <Kbd className="hidden sm:inline-flex">/</Kbd>
                )}
              </InputGroupAddon>
            </InputGroup>
          )}
          {facets.map((f) => (
            <DataTableFacetedFilter
              key={f.id}
              title={f.title}
              options={f.options}
              counts={facetCounts.get(f.id) ?? new Map()}
              selected={facetState[f.id] ?? new Set()}
              onChange={(next) => updateFacet(f.id, next)}
            />
          ))}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <FilterXIcon />
              Reset
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            <DataTableViewOptions
              table={table}
              onReset={() => setColumnVisibility(initialColumnVisibility)}
            />
          </div>
        </div>
      )}

      {/* The outer div is the (only) scroll container so a sticky header can pin to it when `maxHeight` is set. */}
      <div
        className={cn(
          "relative rounded-lg border bg-card",
          maxHeight ? cn("overflow-auto", maxHeight) : "overflow-x-auto"
        )}
      >
        <table data-slot="table" className="w-full caption-bottom text-sm">
          <TableHeader
            className={cn(
              "bg-muted/40 [&_tr]:border-b-0",
              maxHeight &&
                "sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
            )}
          >
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        // Inset shadow draws the header hairline; unlike a border it survives `position: sticky`.
                        "px-3 text-xs font-medium text-muted-foreground shadow-[inset_0_-1px_0_0_var(--color-border)] first:pl-4 last:pr-4",
                        headPad,
                        meta?.width,
                        alignClass(
                          meta?.align ?? (meta?.numeric ? "right" : undefined)
                        ),
                        meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonCount }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className="hover:bg-transparent"
                >
                  {visibleColumns.map((column, c) => {
                    const meta = column.columnDef.meta
                    const widths = ["w-24", "w-40", "w-16", "w-28", "w-32"]
                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "px-3 first:pl-4 last:pr-4",
                          cellPad,
                          alignClass(
                            meta?.align ?? (meta?.numeric ? "right" : undefined)
                          )
                        )}
                      >
                        <Skeleton
                          className={cn(
                            "h-4",
                            meta?.skeleton ?? widths[(i + c) % widths.length],
                            (meta?.align === "right" || meta?.numeric) &&
                              "ml-auto"
                          )}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => {
                const selected = row.getIsSelected()
                return (
                  <TableRow
                    key={row.id}
                    data-state={selected ? "selected" : undefined}
                    className={cn(
                      "group/row transition-colors",
                      interactive && "cursor-pointer",
                      selected
                        ? "bg-brand/5 hover:bg-brand/10 dark:bg-brand/10 dark:hover:bg-brand/15"
                        : "hover:bg-muted/50"
                    )}
                    onClick={(e) => {
                      if (!interactive) return
                      const target = e.target as HTMLElement
                      if (
                        target.closest(
                          "a,button,input,[role=checkbox],[role=menuitem],[data-slot=dropdown-menu-trigger],[data-slot=popover-trigger]"
                        )
                      )
                        return
                      if (window.getSelection()?.toString()) return
                      openRow(row.original, e)
                    }}
                    onAuxClick={(e) => {
                      if (!rowHref || e.button !== 1) return
                      const target = e.target as HTMLElement
                      if (target.closest("a,button,input,[role=checkbox]"))
                        return
                      window.open(rowHref(row.original), "_blank", "noopener")
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-3 first:pl-4 last:pr-4",
                            cellPad,
                            alignClass(
                              meta?.align ??
                                (meta?.numeric ? "right" : undefined)
                            ),
                            meta?.numeric && "tabular-nums",
                            meta?.cellClassName
                          )}
                        >
                          <FlexRender cell={cell} />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumns.length}
                  className="p-0 whitespace-normal"
                >
                  <Empty className="border-0 py-14">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        {emptyIcon ??
                          (isFiltered ? <FilterXIcon /> : <InboxIcon />)}
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">
                        {emptyTitle ??
                          (isFiltered
                            ? "No matching results"
                            : `No ${totalLabel ?? "records"} yet`)}
                      </EmptyTitle>
                      <EmptyDescription className="text-xs">
                        {emptyMessage ??
                          (isFiltered
                            ? "Try adjusting your search or clearing some filters."
                            : "Records will appear here once they are created.")}
                      </EmptyDescription>
                    </EmptyHeader>
                    {isFiltered ? (
                      <EmptyContent>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                        >
                          <FilterXIcon /> Clear filters
                        </Button>
                      </EmptyContent>
                    ) : emptyAction ? (
                      <EmptyContent>{emptyAction}</EmptyContent>
                    ) : null}
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      {!hidePagination && (
        <DataTablePagination
          table={table}
          pagination={pagination}
          totalLabel={totalLabel}
          pageSizeOptions={pageSizeOptions}
        />
      )}

      {/* Selection only ever happens after hydration, so portaling straight to document.body is SSR-safe. */}
      {selectedCount > 0 &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
            role="region"
            aria-label="Selection actions"
          >
            <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] animate-in items-center gap-1.5 rounded-xl border bg-popover/95 p-1.5 pl-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur fade-in-0 slide-in-from-bottom-2 supports-backdrop-filter:bg-popover/85">
              <span className="flex items-center gap-2 pr-2 font-medium whitespace-nowrap tabular-nums">
                <span className="inline-flex size-5 items-center justify-center rounded-md bg-brand text-[11px] font-semibold text-brand-foreground">
                  {selectedCount}
                </span>
                {selectionLabel ? selectionLabel(selectedCount) : "selected"}
              </span>
              {bulkActions && (
                <>
                  <span aria-hidden className="h-5 w-px bg-border" />
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {bulkActions(selectedRows, clearSelection)}
                  </div>
                </>
              )}
              <span aria-hidden className="h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearSelection}
                aria-label="Clear selection"
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon />
              </Button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
