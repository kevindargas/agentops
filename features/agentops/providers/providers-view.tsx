"use client"

import { useSearchParams } from "next/navigation"

import { setQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { expiringKeyCount } from "@/lib/data/providers"
import { daysFromNow } from "@/lib/data/seed"
import { formatCurrency, formatNumber } from "@/lib/format"
import { ApiKeysTab } from "./api-keys-table"
import { ProvidersTab } from "./provider-cards"
import { RateLimitsTab } from "./rate-limits-table"
import { RoutingTab } from "./routing-rules"
import {
  KEY_EXPIRY_WARNING_DAYS,
  keyStore,
  providerStore,
  rateLimitStore,
  routingStore,
} from "./store"

export type ProvidersTabValue = "providers" | "keys" | "routing" | "limits"
const tabValues: ProvidersTabValue[] = [
  "providers",
  "keys",
  "routing",
  "limits",
]

/**
 * Stat row and tab strip for the gateway page. Reads the module-scope stores
 * so revoking a key or pausing a rule updates the cards and the tab counts.
 * The active tab lives in `?tab=`; changes are written with replaceState so
 * the server page is not re-rendered and local mutations survive.
 */
export function ProvidersView() {
  const params = useSearchParams()
  const rawTab = params.get("tab")
  const tab: ProvidersTabValue = tabValues.includes(rawTab as ProvidersTabValue)
    ? (rawTab as ProvidersTabValue)
    : "providers"

  const providers = providerStore.use()
  const keys = keyStore.use()
  const rules = routingStore.use()
  const limits = rateLimitStore.use()

  const connected = providers.filter((p) => p.status === "Connected")
  const impaired = providers.filter((p) => p.status !== "Connected")
  const requests = providers.reduce((s, p) => s + p.requests24h, 0)
  const spend = providers.reduce((s, p) => s + p.spendToday, 0)
  const fallbacks = rules.reduce((s, r) => s + r.fallbackHits24h, 0)
  const activeRules = rules.filter((r) => r.status === "Active").length
  const expiringSoon = expiringKeyCount(KEY_EXPIRY_WARNING_DAYS, keys)
  const expiringNames = keys
    .filter(
      (k) =>
        k.status !== "Revoked" &&
        k.expires !== null &&
        k.expires <= daysFromNow(KEY_EXPIRY_WARNING_DAYS)
    )
    .map((k) => k.name)

  const counts: Record<ProvidersTabValue, number> = {
    providers: providers.length,
    keys: keys.filter((k) => k.status !== "Revoked").length,
    routing: activeRules,
    limits: limits.length,
  }

  const trigger = (value: ProvidersTabValue, label: string) => (
    <TabsTrigger value={value}>
      {label}
      <CountPill
        count={counts[value]}
        tone={tab === value ? "inverse" : "muted"}
        className="ml-1"
      />
    </TabsTrigger>
  )

  return (
    <>
      <StatGrid columns={4}>
        <StatCard
          label="Connections"
          value={connected.length}
          unit={`/ ${providers.length}`}
          hint={
            impaired.length === 0
              ? "All providers healthy"
              : `${impaired.map((p) => p.name).join(", ")} need attention`
          }
          href="/agentops/providers?tab=providers"
        />
        <StatCard
          label="Gateway requests · 24h"
          value={formatNumber(requests, true)}
          hint={`${formatCurrency(spend)} spent today across providers`}
        />
        <StatCard
          label="Fallback hits · 24h"
          value={formatNumber(fallbacks)}
          hint={`${activeRules} active routing rule${activeRules === 1 ? "" : "s"}`}
          href="/agentops/providers?tab=routing"
        />
        <StatCard
          label={`Keys expiring < ${KEY_EXPIRY_WARNING_DAYS}d`}
          value={expiringSoon}
          hint={
            expiringSoon
              ? expiringNames.join(", ")
              : "No credentials due for rotation"
          }
          href="/agentops/providers?tab=keys"
        />
      </StatGrid>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setQueryParam("tab", value === "providers" ? null : (value as string))
        }
        className="gap-4"
      >
        <TabsList>
          {trigger("providers", "Providers")}
          {trigger("keys", "API Keys")}
          {trigger("routing", "Routing")}
          {trigger("limits", "Rate Limits")}
        </TabsList>
        <TabsContent value="providers">
          <ProvidersTab />
        </TabsContent>
        <TabsContent value="keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="routing">
          <RoutingTab />
        </TabsContent>
        <TabsContent value="limits">
          <RateLimitsTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
