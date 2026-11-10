"use client"

import * as React from "react"

import { setQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { costByAgent } from "@/lib/data/costs"
import { BudgetsTable } from "./budgets-table"
import { CostAllocationTable } from "./cost-allocation-table"
import { CostsOverview } from "./costs-overview"
import { SavingsPanel } from "./savings-panel"
import { budgetStore, savingsStore } from "./store"

export type CostsTabValue = "budgets" | "allocation" | "savings"

const tabValues: CostsTabValue[] = ["budgets", "allocation", "savings"]

export function CostsView({
  initialTab = "budgets",
  initialAgentId,
  initialBudgetId,
}: {
  initialTab?: CostsTabValue
  /** From `?agent=`: preselects the agent facet on Budgets and Allocation. */
  initialAgentId?: string
  /** From `?budget=`: opens that budget's sheet on load. */
  initialBudgetId?: string
}) {
  const [tab, setTab] = React.useState<CostsTabValue>(initialTab)
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
          const next = tabValues.includes(v as CostsTabValue)
            ? (v as CostsTabValue)
            : "budgets"
          setTab(next)
          setQueryParam("tab", next === "budgets" ? null : next)
        }}
        className="gap-4"
      >
        <TabsList>
          {trigger("budgets", "Budgets")}
          {trigger("allocation", "Allocation")}
          {trigger("savings", "Savings")}
        </TabsList>
        <TabsContent value="budgets">
          <BudgetsTable
            initialAgentId={initialAgentId}
            initialBudgetId={initialBudgetId}
          />
        </TabsContent>
        <TabsContent value="allocation">
          <CostAllocationTable initialAgentId={initialAgentId} />
        </TabsContent>
        <TabsContent value="savings">
          <SavingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
