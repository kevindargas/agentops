export type CostsTabValue = "budgets" | "allocation" | "savings"

export const costsTabs: CostsTabValue[] = ["budgets", "allocation", "savings"]

export function isCostsTab(v: string | undefined): v is CostsTabValue {
  return costsTabs.includes(v as CostsTabValue)
}
