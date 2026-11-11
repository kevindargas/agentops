"use client"

import { setQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { costByAgent } from "@/lib/data/costs"
import { BudgetsTable } from "./budgets-table"
import { CostAllocationTable } from "./cost-allocation-table"
import { CostsOverview } from "./costs-overview"
import { SavingsPanel } from "./savings-panel"
import { budgetStore, savingsStore } from "./store"
import { isCostsTab, type CostsTabValue } from "./tabs"

export { isCostsTab, type CostsTabValue }

/**
 * Overview and tab shell for /agentops/costs. The URL is the source of truth:
 * `CostsRoute` reads `?tab=`, `?agent=` and `?budget=` and passes them in;
 * tab changes and sheet opens are written back with `setQueryParam` (no
 * navigation).
 */
export function CostsView({
  tab = "budgets",
  agentId,
  budgetId,
}: {
  /** `?tab=`, already validated with `isCostsTab`. */
  tab?: CostsTabValue
  /** From `?agent=`: preselects the agent facet on Budgets and Allocation. */
  agentId?: string
  /** From `?budget=`: the budget whose sheet is open. */
  budgetId?: string
}) {
  const budgets = budgetStore.use()
  const savings = savingsStore.use()
  const counts: Record<CostsTabValue, number> = {
    budgets: budgets.length,
    allocation: costByAgent.length,
    savings: savings.filter((s) => s.status === "Open").length,
  }
  const trigger = (value: CostsTabValue, label: string) => (
    <TabsTrigger value={value}>
      {label}
      <CountPill
        count={counts[value]}
        tone={tab === value ? "inverse" : "muted"}
        label={value === "savings" ? "open" : undefined}
      />
    </TabsTrigger>
  )
  return (
    <div className="flex flex-col gap-6">
      <CostsOverview />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = isCostsTab(String(v)) ? (v as CostsTabValue) : "budgets"
          setQueryParam("tab", next === "budgets" ? null : next)
        }}
        className="gap-4"
      >
        <TabsList>
          {trigger("budgets", "Budgets")}
          {trigger("allocation", "Allocation")}
          {trigger("savings", "Savings")}
        </TabsList>
        {/* The agent facet is seeded once per `?agent=`; neither table writes
            that param, so the keys only change on navigation. */}
        <TabsContent value="budgets">
          <BudgetsTable
            key={agentId ?? ""}
            initialAgentId={agentId}
            openId={budgetId ?? null}
            onOpenChange={(id) => setQueryParam("budget", id)}
          />
        </TabsContent>
        <TabsContent value="allocation">
          <CostAllocationTable key={agentId ?? ""} initialAgentId={agentId} />
        </TabsContent>
        <TabsContent value="savings">
          <SavingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
