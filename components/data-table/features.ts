import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

/**
 * Per-column presentation hints. Read by <DataTable /> when it renders the
 * header and body cells so individual column definitions do not have to repeat
 * alignment / width classes in every cell renderer.
 */
export interface DataTableColumnMeta {
  /** Horizontal alignment for both header and cells. Numeric columns should be `right`. */
  align?: "left" | "center" | "right"
  /** Width classes applied to the header cell, e.g. `w-28` or `min-w-56 max-w-md`. */
  width?: string
  /** Extra classes for the header cell. */
  headerClassName?: string
  /** Extra classes for body cells. */
  cellClassName?: string
  /** Human label used by the column visibility menu when `header` is not a string. */
  label?: string
  /** Mark the column as numeric: right-aligned, tabular figures. */
  numeric?: boolean
  /** Skeleton width while the table is in its loading state (`w-*` class). */
  skeleton?: string
}

/**
 * Shared TanStack Table v9 feature registry. Only the features listed here are
 * bundled. Search and faceted filtering are applied to the data before it
 * reaches the table (see <DataTable />), which keeps filters URL-friendly and
 * lets us show option counts cheaply.
 */
export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  // Built-in sort fns must be registered explicitly in v9, otherwise columns
  // that rely on the auto-detected `alphanumeric` / `datetime` sort warn and
  // fall back to no-op sorting.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

export type DataTableFeatures = typeof dataTableFeatures
