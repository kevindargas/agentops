import { budgets, savingsOpportunities } from "@/lib/data/costs"
import { createListStore, createStore } from "@/lib/store"

/**
 * Module-scoped client state for the Costs & Budgets page. The overview stat
 * cards, the tab counts, the budgets table and the savings cards all read
 * the same lists, so a budget edit or a dismissed opportunity moves every
 * number at once. Not persisted: a reload returns to the seed.
 */
export const budgetStore = createListStore(budgets, (b) => b.id)
export const savingsStore = createListStore(savingsOpportunities, (s) => s.id)

/** Free-text notes recorded when a budget is saved (runbook step "what to record"). */
export const budgetNoteStore = createStore<{ notes: Record<string, string> }>({
  notes: {},
})
