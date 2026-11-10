import { PageSkeleton } from "@/components/shared/skeletons"

/**
 * Route-level loading state shared by every page without its own
 * `loading.tsx`. Deliberately neutral (header plus two cards) so list pages
 * and record pages both transition from it without a layout jump. Record
 * routes can add `loading.tsx` rendering `<RecordSkeleton />`; list routes
 * can wrap tables in `<Suspense fallback={<TableSkeleton />}>`.
 */
export default function Loading() {
  return <PageSkeleton />
}
