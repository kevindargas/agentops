import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import {
  TracesDescription,
  TracesTitle,
  TracesView,
} from "@/features/agentops/traces-view"

export const metadata: Metadata = { title: "Traces" }

export default function TracesPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/traces"
        title={<TracesTitle />}
        description={<TracesDescription />}
      />
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <TracesView />
      </Suspense>
    </>
  )
}
