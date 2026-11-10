import type { Metadata } from "next"
import Link from "next/link"
import { CoinsIcon, PlugZapIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  CostsView,
  type CostsTabValue,
} from "@/features/agentops/costs/costs-view"

export const metadata: Metadata = { title: "Costs & Budgets" }

const tabs: CostsTabValue[] = ["budgets", "allocation", "savings"]

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab = tabs.includes(tab as CostsTabValue)
    ? (tab as CostsTabValue)
    : "budgets"
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<CoinsIcon />}
        title="Costs & Budgets"
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
      <CostsView key={initialTab} initialTab={initialTab} />
    </>
  )
}
