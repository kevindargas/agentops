import type { Metadata } from "next"
import Link from "next/link"
import {
  CoinsIcon,
  KeyRoundIcon,
  PlugZapIcon,
  RouteIcon,
  ZapIcon,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import {
  ProvidersView,
  type ProvidersTabValue,
} from "@/features/agentops/providers/providers-view"
import { apiKeys, providers, routingRules } from "@/lib/data/providers"
import { NOW } from "@/lib/data/seed"
import { formatCurrency, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Providers & Routing" }

const tabs: ProvidersTabValue[] = ["providers", "keys", "routing", "limits"]

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab = tabs.includes(tab as ProvidersTabValue)
    ? (tab as ProvidersTabValue)
    : "providers"

  const connected = providers.filter((p) => p.status === "Connected")
  const requests = providers.reduce((s, p) => s + p.requests24h, 0)
  const spend = providers.reduce((s, p) => s + p.spendToday, 0)
  const fallbacks = routingRules.reduce((s, r) => s + r.fallbackHits24h, 0)
  const soon = apiKeys.filter(
    (k) =>
      k.status !== "Revoked" &&
      k.expires &&
      new Date(k.expires).getTime() - NOW.getTime() < 14 * 86_400_000
  )

  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<PlugZapIcon />}
        title="Providers, Keys & Routing"
        description="The gateway between agents and model vendors: provider connections and their health, scoped credentials, routing chains with fallbacks, and the quotas that keep one agent from starving the rest."
        actions={
          <Button variant="outline" render={<Link href="/agentops/costs" />}>
            <CoinsIcon /> Costs & budgets
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Connections"
          value={connected.length}
          unit={`/ ${providers.length}`}
          icon={<PlugZapIcon />}
          hint={
            providers.length - connected.length === 0
              ? "All providers healthy"
              : `${providers
                  .filter((p) => p.status !== "Connected")
                  .map((p) => p.name)
                  .join(", ")} need attention`
          }
        />
        <StatCard
          size="sm"
          label="Gateway requests · 24h"
          value={formatNumber(requests, true)}
          icon={<ZapIcon />}
          hint={`${formatCurrency(spend)} spent today across providers`}
        />
        <StatCard
          size="sm"
          label="Fallback hits · 24h"
          value={formatNumber(fallbacks)}
          icon={<RouteIcon />}
          hint={`${routingRules.filter((r) => r.status === "Active").length} active routing rules`}
          href="/agentops/providers?tab=routing"
        />
        <StatCard
          size="sm"
          label="Keys expiring < 14d"
          value={soon.length}
          icon={<KeyRoundIcon />}
          hint={
            soon.length
              ? soon.map((k) => k.name).join(", ")
              : "No credentials due for rotation"
          }
          href="/agentops/providers?tab=keys"
        />
      </div>
      <ProvidersView key={initialTab} initialTab={initialTab} />
    </>
  )
}
