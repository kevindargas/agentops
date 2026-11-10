"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  apiKeys,
  providers,
  rateLimits,
  routingRules,
} from "@/lib/data/providers"
import { ApiKeysTab } from "./api-keys-table"
import { ProvidersTab } from "./provider-cards"
import { RateLimitsTab } from "./rate-limits-table"
import { RoutingTab } from "./routing-rules"

export type ProvidersTabValue = "providers" | "keys" | "routing" | "limits"

export function ProvidersView({
  initialTab = "providers",
}: {
  initialTab?: ProvidersTabValue
}) {
  const counts: Record<ProvidersTabValue, number> = {
    providers: providers.length,
    keys: apiKeys.filter((k) => k.status !== "Revoked").length,
    routing: routingRules.filter((r) => r.status === "Active").length,
    limits: rateLimits.length,
  }
  const tab = (value: ProvidersTabValue, label: string) => (
    <TabsTrigger value={value}>
      {label}
      <span className="ml-1 text-xs text-muted-foreground tabular-nums">
        {counts[value]}
      </span>
    </TabsTrigger>
  )
  return (
    <Tabs defaultValue={initialTab} className="gap-4">
      <TabsList>
        {tab("providers", "Providers")}
        {tab("keys", "API Keys")}
        {tab("routing", "Routing")}
        {tab("limits", "Rate Limits")}
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
  )
}
