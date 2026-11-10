import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ClipboardListIcon,
  PackageIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  WalletIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { RequestsTable } from "@/features/requests/requests-table"
import { requests } from "@/lib/data"
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
  const spend = requests
    .filter((r) => r.state === "Closed Complete")
    .reduce((a, r) => a + r.price, 0)
  const items = open.reduce((a, r) => a + r.items.length, 0)
  return (
    <>
      <PageHeader
        title="Requests"
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open requests"
          value={open.length}
          icon={<PackageIcon />}
          hint={`${items} requested items in flight`}
        />
        <StatCard
          label="Pending approval"
          value={pending}
          icon={<ShieldCheckIcon />}
          hint="Waiting on a manager decision"
        />
        <StatCard
          label="Open fulfillment tasks"
          value={tasks}
          icon={<ClipboardListIcon />}
          hint="Across all fulfillment groups"
        />
        <StatCard
          label="Fulfilled spend (30d)"
          value={formatCurrency(spend, true)}
          delta={4}
          upIsGood={false}
          icon={<WalletIcon />}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RequestsTable />
      </Suspense>
    </>
  )
}
