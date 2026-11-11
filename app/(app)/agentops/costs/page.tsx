import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { PlugZapIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { CostsRoute } from "@/features/agentops/costs/costs-route"

export const metadata: Metadata = { title: "Costs & Budgets" }

/**
 * Static shell. `?tab=`, `?agent=` and `?budget=` are read on the client by
 * `CostsRoute` inside the Suspense boundary, so this page never touches
 * `searchParams` and can be exported statically.
 */
export default function CostsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/costs"
        description="FinOps for the fleet: where the money goes by agent, model and provider, budgets with automatic actions on breach, and the savings still available without trading away quality."
        actions={
          <Button
            variant="outline"
            render={<Link href="/agentops/providers?tab=routing" />}
          >
            <PlugZapIcon /> Providers & routing
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <CostsRoute />
      </Suspense>
    </>
  )
}
