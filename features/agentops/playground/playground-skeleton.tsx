import { Skeleton } from "@/components/ui/skeleton"

/**
 * Loading state for the Playground. Shared by the route `loading.tsx` and the
 * Suspense fallback around the client component so the two do not flash
 * different shapes.
 */
export function PlaygroundSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="grid animate-in gap-6 duration-300 fade-in-0 motion-reduce:animate-none xl:grid-cols-[22rem_minmax(0,1fr)]"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="h-[32rem] rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
