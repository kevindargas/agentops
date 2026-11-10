import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { CoinsIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { ProvidersView } from "@/features/agentops/providers/providers-view"

export const metadata: Metadata = { title: "Providers & Routing" }

/**
 * The gateway page. Tabs (`?tab=`), the open key (`?key=`) and the open rule
 * (`?rule=`) live in the URL and are read by the client view, so stat cards,
 * tab counts and tables share one client store and stay in sync after a
 * rotation, revoke or pause.
 */
export default function ProvidersPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/providers"
        description="The gateway between agents and model vendors: provider connections and their health, scoped credentials, routing chains with fallbacks, and the quotas that keep one agent from starving the rest."
        actions={
          <Button variant="outline" render={<Link href="/agentops/costs" />}>
            <CoinsIcon /> Costs & Budgets
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <ProvidersView />
      </Suspense>
    </>
  )
}
