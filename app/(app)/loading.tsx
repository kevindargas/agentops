import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading state. Mirrors the common page anatomy (header, stat
 * tiles, a table) so the layout does not jump when real content arrives.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex animate-in flex-col gap-6 duration-300 fade-in-0 motion-reduce:animate-none"
    >
      <span className="sr-only">Loading…</span>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-3.5 w-20 shrink-0" />
              <Skeleton
                className="h-3.5 flex-1"
                style={{ maxWidth: `${55 + (i % 3) * 12}%` }}
              />
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              <Skeleton className="hidden h-3.5 w-24 shrink-0 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
