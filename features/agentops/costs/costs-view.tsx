"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { budgets, costByAgent, savingsOpportunities } from "@/lib/data/costs"
import { BudgetsTable } from "./budgets-table"
import { CostAllocationTable } from "./cost-allocation-table"
import { CostsOverview } from "./costs-overview"
import { SavingsPanel } from "./savings-panel"

export type CostsTabValue = "budgets" | "allocation" | "savings"

export function CostsView({
  initialTab = "budgets",
}: {
  initialTab?: CostsTabValue
}) {
  const counts: Record<CostsTabValue, number> = {
    budgets: budgets.length,
    allocation: costByAgent.length,
    savings: savingsOpportunities.filter((s) => s.status === "Open").length,
  }
  const tab = (value: CostsTabValue, label: string) => (
    <TabsTrigger value={value}>
      {label}
      <span className="ml-1 text-xs text-muted-foreground tabular-nums">
        {counts[value]}
      </span>
    </TabsTrigger>
  )
  return (
    <div className="flex flex-col gap-6">
      <CostsOverview />
      <Tabs defaultValue={initialTab} className="gap-4">
        <TabsList>
          {tab("budgets", "Budgets")}
          {tab("allocation", "Allocation")}
          {tab("savings", "Savings")}
        </TabsList>
        <TabsContent value="budgets">
          <BudgetsTable />
        </TabsContent>
        <TabsContent value="allocation">
          <CostAllocationTable />
        </TabsContent>
        <TabsContent value="savings">
          <SavingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
