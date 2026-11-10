import { cn } from "cn"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function LoadingRoot({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex animate-in flex-col gap-4 duration-300 fade-in-0 motion-reduce:animate-none",
        className
      )}
    >
      <span className="sr-only">Loading</span>
      {children}
    </div>
  )
}

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  /** Draw the search / filter / view row above the table. */
  toolbar?: boolean
  className?: string
}

/**
 * Suspense fallback for list pages: a toolbar row and N skeleton rows in the
 * same frame `DataTable` renders, so the swap to real rows does not jump.
 */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  toolbar = true,
  className,
}: TableSkeletonProps) {
  const widths = ["w-24", "w-40", "w-16", "w-28", "w-32", "w-20"]
  return (
    <LoadingRoot className={cn("gap-3", className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-64" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
      )}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex h-9 items-center gap-3 border-b bg-muted/40 px-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-3", widths[c % widths.length])}
            />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex h-11 items-center gap-3 px-4">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn("h-3.5", widths[(r + c) % widths.length])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
    </LoadingRoot>
  )
}

export interface RecordSkeletonProps {
  /** Mirror `RecordLayout`'s details sidebar. */
  aside?: boolean
  className?: string
}

/**
 * Loading state for `[id]` and `[number]` record routes: the sticky toolbar,
 * title block, meta chips and a two-column body matching `RecordHeader` plus
 * `RecordLayout`.
 */
export function RecordSkeleton({
  aside = true,
  className,
}: RecordSkeletonProps) {
  return (
    <LoadingRoot className={cn("gap-6", className)}>
      <div className="-mx-4 -mt-4 flex items-center gap-3 border-b px-4 py-2 lg:-mx-6 lg:-mt-6 lg:px-6">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-8" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-2/3 max-w-xl" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-md" />
          ))}
        </div>
      </div>
      <div className={cn(aside && "record-grid items-start")}>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-3/4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        {aside && (
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3.5 w-36" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </LoadingRoot>
  )
}

/** Neutral page skeleton: a header and two cards. Used by `app/(app)/loading.tsx`. */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRoot className={cn("gap-6", className)}>
      <div className="flex flex-col gap-3 border-b border-border/70 pb-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, r) => (
                <div key={r} className="flex items-center gap-4">
                  <Skeleton className="h-3.5 w-20 shrink-0" />
                  <Skeleton
                    className="h-3.5 flex-1"
                    style={{ maxWidth: `${55 + (r % 3) * 12}%` }}
                  />
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </LoadingRoot>
  )
}
