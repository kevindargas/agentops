import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheckIcon, ShoppingBagIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { RequestsTable } from "@/features/requests/requests-table"
import { requests } from "@/lib/data/itsm"
import { fulfilledRequestSpendDelta } from "@/lib/data/metrics"
import { formatCurrency } from "@/lib/format"

export const metadata: Metadata = { title: "Requests" }

export default function RequestsPage() {
  const open = requests.filter((r) => !r.state.startsWith("Closed"))
  const pending = requests.filter((r) => r.state === "Pending Approval").length
  const tasks = open.reduce(
    (acc, r) =>
      acc +
      r.items.reduce(
        (a, i) =>
          a + i.tasks.filter((t) => !t.state.startsWith("Closed")).length,
        0
      ),
    0
  )
  const spend = fulfilledRequestSpendDelta(30)
  const items = open.reduce((a, r) => a + r.items.length, 0)
  return (
    <>
      <PageHeader
        nav="/itsm/requests"
        description="Service requests from the catalog, their requested items (RITM) and the fulfillment tasks (SCTASK) that deliver them."
        actions={
          <>
            <Button variant="outline" render={<Link href="/approvals" />}>
              <ShieldCheckIcon /> Approvals
            </Button>
            <Button render={<Link href="/itsm/catalog" />}>
              <ShoppingBagIcon /> New request
            </Button>
          </>
        }
      />
      <StatGrid columns={4}>
        <StatCard
          label="Open requests"
          value={open.length}
          hint={`${items} requested items in flight`}
        />
        <StatCard
          label="Pending approval"
          value={pending}
          hint="Waiting on a manager decision"
        />
        <StatCard
          label="Open fulfillment tasks"
          value={tasks}
          hint="Across all fulfillment groups"
        />
        <StatCard
          label="Fulfilled spend (30d)"
          value={formatCurrency(spend.current, true)}
          delta={spend.deltaPct ?? undefined}
          deltaLabel="vs previous 30 days"
          upIsGood={false}
          hint={
            spend.deltaPct === null
              ? `${formatCurrency(spend.previous, true)} in the previous 30 days`
              : undefined
          }
        />
      </StatGrid>
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <RequestsTable />
      </Suspense>
    </>
  )
}
